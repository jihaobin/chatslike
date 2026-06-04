import { and, asc, desc, eq, gt, lte } from 'drizzle-orm';
import type { AiModelSettings, ModelAbilities } from 'model-bank';

import {
  adminAuditLogs,
  aiModels,
  aiProviders,
  modelPricing,
  type ModelPricingItem,
  type NewModelPricing,
  type UsageModality,
  users,
} from '@/database/schemas';
import type { LobeChatDatabase, Transaction } from '@/database/type';
import { getLLMConfig } from '@/envs/llm';

import {
  getPlatformModelMetadata,
  NEWAPI_CREDENTIAL_KEYS,
  NEWAPI_PROVIDER_ID,
  normalizeUpstreamProvider,
  PLATFORM_CATALOG_USER_ID,
} from './constants';

type CatalogDb = LobeChatDatabase | Transaction;

export interface UpdatePlatformModelParams {
  abilities?: ModelAbilities;
  contextWindowTokens?: number | null;
  description?: string | null;
  displayName?: string | null;
  enabled?: boolean;
  model: string;
  reason: string;
  settings?: AiModelSettings & Record<string, unknown>;
  sort?: number | null;
  upstreamDisplayName?: string | null;
  upstreamProvider?: string | null;
}

export interface CreatePricingVersionParams {
  currency?: string;
  effectiveAt?: Date;
  fixedCreditsPerUnit?: number;
  inputCreditsPerMillionTokens?: number;
  modality: UsageModality;
  model: string;
  outputCreditsPerMillionTokens?: number;
  parameterRules?: Record<string, unknown>;
  priceKey?: string;
  providerCost?: number;
  reason: string;
  sellRate?: number;
  unit?: string;
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const assertSingleRow = <T>(value: T | undefined, message: string): T => {
  if (!value) throw new Error(message);

  return value;
};

export class PlatformCatalogService {
  constructor(
    private readonly db: LobeChatDatabase,
    private readonly adminUserId: string,
    private readonly llmConfig: Record<string, unknown> = getLLMConfig() as Record<string, unknown>,
  ) {}

  private getCredentialStatus() {
    const missingKeys = NEWAPI_CREDENTIAL_KEYS.filter(
      (key) => !isNonEmptyString(this.llmConfig[key]),
    );

    return {
      configured: missingKeys.length === 0,
      keys: [...NEWAPI_CREDENTIAL_KEYS],
      missingKeys,
    };
  }

  private async ensureCatalogUser(db: CatalogDb = this.db) {
    await db.insert(users).values({ id: PLATFORM_CATALOG_USER_ID }).onConflictDoNothing();
  }

  private async getProvider(db: CatalogDb = this.db) {
    const [provider] = await db
      .select()
      .from(aiProviders)
      .where(
        and(
          eq(aiProviders.id, NEWAPI_PROVIDER_ID),
          eq(aiProviders.userId, PLATFORM_CATALOG_USER_ID),
        ),
      )
      .limit(1);

    return provider;
  }

  private async getModel(model: string, db: CatalogDb = this.db) {
    const [row] = await db
      .select()
      .from(aiModels)
      .where(
        and(
          eq(aiModels.id, model),
          eq(aiModels.providerId, NEWAPI_PROVIDER_ID),
          eq(aiModels.userId, PLATFORM_CATALOG_USER_ID),
        ),
      )
      .limit(1);

    return row;
  }

  private async createAuditLog(
    db: CatalogDb,
    params: {
      action:
        | 'platform_catalog_create_pricing'
        | 'platform_catalog_retire_pricing'
        | 'platform_catalog_toggle_model'
        | 'platform_catalog_update_model'
        | 'platform_catalog_update_provider';
      metadata?: Record<string, unknown>;
      reason: string;
    },
  ) {
    await db.insert(adminAuditLogs).values({
      action: params.action,
      adminUserId: this.adminUserId,
      metadata: params.metadata ?? {},
      reason: params.reason,
    });
  }

  private async getActivePricingByModel(now = new Date()) {
    const rows = await this.db
      .select()
      .from(modelPricing)
      .where(
        and(
          eq(modelPricing.provider, NEWAPI_PROVIDER_ID),
          eq(modelPricing.status, 'active'),
          lte(modelPricing.effectiveAt, now),
        ),
      )
      .orderBy(desc(modelPricing.effectiveAt), desc(modelPricing.createdAt));

    return rows.reduce<Map<string, ModelPricingItem>>((map, row) => {
      if (!map.has(row.model)) map.set(row.model, row);

      return map;
    }, new Map());
  }

  private async countFuturePricing(now = new Date()) {
    const rows = await this.db
      .select({ id: modelPricing.id })
      .from(modelPricing)
      .where(
        and(
          eq(modelPricing.provider, NEWAPI_PROVIDER_ID),
          eq(modelPricing.status, 'active'),
          gt(modelPricing.effectiveAt, now),
        ),
      );

    return rows.length;
  }

  getNewApiProviderStatus = async () => {
    const [provider, models, activePricingByModel, futurePricingCount] = await Promise.all([
      this.getProvider(),
      this.db
        .select()
        .from(aiModels)
        .where(
          and(
            eq(aiModels.providerId, NEWAPI_PROVIDER_ID),
            eq(aiModels.userId, PLATFORM_CATALOG_USER_ID),
          ),
        ),
      this.getActivePricingByModel(),
      this.countFuturePricing(),
    ]);
    const pricingGapCount = models.filter((model) => !activePricingByModel.has(model.id)).length;

    return {
      credentialStatus: this.getCredentialStatus(),
      enabled: provider?.enabled !== false,
      enabledModelCount: models.filter((model) => model.enabled !== false).length,
      futurePricingCount,
      modelCount: models.length,
      pricingGapCount,
      provider: NEWAPI_PROVIDER_ID,
      providerName: provider?.name ?? 'New API',
    };
  };

  updateNewApiProviderStatus = async (params: { enabled: boolean; reason: string }) => {
    return this.db.transaction(async (tx) => {
      await this.ensureCatalogUser(tx);
      const before = await this.getProvider(tx);
      const now = new Date();

      const [provider] = await tx
        .insert(aiProviders)
        .values({
          enabled: params.enabled,
          id: NEWAPI_PROVIDER_ID,
          name: before?.name ?? 'New API',
          source: 'builtin',
          updatedAt: now,
          userId: PLATFORM_CATALOG_USER_ID,
        })
        .onConflictDoUpdate({
          set: {
            enabled: params.enabled,
            name: before?.name ?? 'New API',
            source: 'builtin',
            updatedAt: now,
          },
          target: [aiProviders.id, aiProviders.userId],
        })
        .returning();

      await this.createAuditLog(tx, {
        action: 'platform_catalog_update_provider',
        metadata: {
          after: { enabled: provider.enabled },
          before: before ? { enabled: before.enabled } : undefined,
          provider: NEWAPI_PROVIDER_ID,
        },
        reason: params.reason,
      });

      return provider;
    });
  };

  listPlatformModels = async (
    params: {
      enabled?: boolean;
      modality?: string;
      upstreamProvider?: string;
    } = {},
  ) => {
    const conditions = [
      eq(aiModels.providerId, NEWAPI_PROVIDER_ID),
      eq(aiModels.userId, PLATFORM_CATALOG_USER_ID),
    ];
    if (typeof params.enabled === 'boolean') conditions.push(eq(aiModels.enabled, params.enabled));
    if (params.modality) conditions.push(eq(aiModels.type, params.modality));

    const [models, activePricingByModel, futurePrices] = await Promise.all([
      this.db
        .select()
        .from(aiModels)
        .where(and(...conditions))
        .orderBy(asc(aiModels.sort), desc(aiModels.enabled), desc(aiModels.updatedAt)),
      this.getActivePricingByModel(),
      this.db
        .select()
        .from(modelPricing)
        .where(
          and(
            eq(modelPricing.provider, NEWAPI_PROVIDER_ID),
            gt(modelPricing.effectiveAt, new Date()),
          ),
        )
        .orderBy(asc(modelPricing.effectiveAt)),
    ]);

    const futurePriceByModel = futurePrices.reduce<Map<string, ModelPricingItem>>((map, row) => {
      if (!map.has(row.model)) map.set(row.model, row);

      return map;
    }, new Map());
    const upstreamFilter = params.upstreamProvider
      ? normalizeUpstreamProvider(params.upstreamProvider)
      : undefined;

    return models
      .map((model) => {
        const metadata = getPlatformModelMetadata(model.settings);
        const upstreamProvider = normalizeUpstreamProvider(metadata.upstreamProvider);

        return {
          ...model,
          currentPricing: activePricingByModel.get(model.id),
          hasPricingGap: !activePricingByModel.has(model.id),
          nextPricing: futurePriceByModel.get(model.id),
          upstreamDisplayName: metadata.upstreamDisplayName,
          upstreamProvider,
        };
      })
      .filter((model) => !upstreamFilter || model.upstreamProvider === upstreamFilter);
  };

  updatePlatformModel = async (params: UpdatePlatformModelParams) => {
    return this.db.transaction(async (tx) => {
      const before = assertSingleRow(
        await this.getModel(params.model, tx),
        `Platform model ${params.model} not found`,
      );
      const beforeMetadata = getPlatformModelMetadata(before.settings);
      const settings = {
        ...((before.settings ?? {}) as Record<string, unknown>),
        ...params.settings,
        upstreamDisplayName: params.upstreamDisplayName ?? beforeMetadata.upstreamDisplayName,
        upstreamProvider: params.upstreamProvider ?? beforeMetadata.upstreamProvider,
      };
      const values = {
        abilities: params.abilities,
        contextWindowTokens: params.contextWindowTokens,
        description: params.description,
        displayName: params.displayName,
        enabled: params.enabled,
        settings: settings as AiModelSettings,
        sort: params.sort,
        updatedAt: new Date(),
      } satisfies Partial<typeof aiModels.$inferInsert>;

      const updateValues = Object.fromEntries(
        Object.entries(values).filter(([, value]) => value !== undefined),
      ) as Partial<typeof aiModels.$inferInsert>;

      const [after] = await tx
        .update(aiModels)
        .set(updateValues)
        .where(
          and(
            eq(aiModels.id, params.model),
            eq(aiModels.providerId, NEWAPI_PROVIDER_ID),
            eq(aiModels.userId, PLATFORM_CATALOG_USER_ID),
          ),
        )
        .returning();
      assertSingleRow(after, `Platform model ${params.model} update failed`);

      await this.createAuditLog(tx, {
        action: 'platform_catalog_update_model',
        metadata: {
          after: {
            contextWindowTokens: after.contextWindowTokens,
            displayName: after.displayName,
            enabled: after.enabled,
            sort: after.sort,
            upstreamProvider: getPlatformModelMetadata(after.settings).upstreamProvider,
          },
          before: {
            contextWindowTokens: before.contextWindowTokens,
            displayName: before.displayName,
            enabled: before.enabled,
            sort: before.sort,
            upstreamProvider: beforeMetadata.upstreamProvider,
          },
          model: params.model,
          provider: NEWAPI_PROVIDER_ID,
          upstreamProvider: getPlatformModelMetadata(after.settings).upstreamProvider,
        },
        reason: params.reason,
      });

      return after;
    });
  };

  togglePlatformModelEnabled = async (params: {
    enabled: boolean;
    model: string;
    reason: string;
  }) => {
    return this.db.transaction(async (tx) => {
      const before = assertSingleRow(
        await this.getModel(params.model, tx),
        `Platform model ${params.model} not found`,
      );
      const metadata = getPlatformModelMetadata(before.settings);
      const [after] = await tx
        .update(aiModels)
        .set({ enabled: params.enabled, updatedAt: new Date() })
        .where(
          and(
            eq(aiModels.id, params.model),
            eq(aiModels.providerId, NEWAPI_PROVIDER_ID),
            eq(aiModels.userId, PLATFORM_CATALOG_USER_ID),
          ),
        )
        .returning();
      assertSingleRow(after, `Platform model ${params.model} toggle failed`);

      await this.createAuditLog(tx, {
        action: 'platform_catalog_toggle_model',
        metadata: {
          after: { enabled: params.enabled },
          before: { enabled: before.enabled },
          model: params.model,
          provider: NEWAPI_PROVIDER_ID,
          upstreamProvider: metadata.upstreamProvider,
        },
        reason: params.reason,
      });

      return after;
    });
  };

  listModelPricing = async (params: { modality?: UsageModality; model: string }) => {
    const conditions = [
      eq(modelPricing.provider, NEWAPI_PROVIDER_ID),
      eq(modelPricing.model, params.model),
    ];
    if (params.modality) conditions.push(eq(modelPricing.modality, params.modality));

    return this.db
      .select()
      .from(modelPricing)
      .where(and(...conditions))
      .orderBy(desc(modelPricing.effectiveAt), desc(modelPricing.createdAt));
  };

  createModelPricingVersion = async (params: CreatePricingVersionParams) => {
    return this.db.transaction(async (tx) => {
      const model = assertSingleRow(
        await this.getModel(params.model, tx),
        `Platform model ${params.model} not found`,
      );
      const metadata = getPlatformModelMetadata(model.settings);
      const values: NewModelPricing = {
        currency: params.currency,
        effectiveAt: params.effectiveAt,
        fixedCreditsPerUnit: params.fixedCreditsPerUnit,
        inputCreditsPerMillionTokens: params.inputCreditsPerMillionTokens,
        modality: params.modality,
        model: params.model,
        outputCreditsPerMillionTokens: params.outputCreditsPerMillionTokens,
        parameterRules: params.parameterRules,
        priceKey: params.priceKey ?? `${params.modality}:${params.model}:${Date.now()}`,
        provider: NEWAPI_PROVIDER_ID,
        providerCost: params.providerCost,
        sellRate: params.sellRate,
        status: 'active',
        unit: params.unit,
      };

      const [created] = await tx.insert(modelPricing).values(values).returning();
      await this.createAuditLog(tx, {
        action: 'platform_catalog_create_pricing',
        metadata: {
          after: {
            effectiveAt: created.effectiveAt,
            priceKey: created.priceKey,
            status: created.status,
          },
          model: params.model,
          priceKey: created.priceKey,
          provider: NEWAPI_PROVIDER_ID,
          upstreamProvider: metadata.upstreamProvider,
        },
        reason: params.reason,
      });

      return created;
    });
  };

  retireModelPricingVersion = async (params: { id: string; reason: string }) => {
    return this.db.transaction(async (tx) => {
      const [before] = await tx
        .select()
        .from(modelPricing)
        .where(and(eq(modelPricing.id, params.id), eq(modelPricing.provider, NEWAPI_PROVIDER_ID)))
        .limit(1);
      assertSingleRow(before, `Model pricing ${params.id} not found`);

      const [after] = await tx
        .update(modelPricing)
        .set({ status: 'retired', updatedAt: new Date() })
        .where(and(eq(modelPricing.id, params.id), eq(modelPricing.provider, NEWAPI_PROVIDER_ID)))
        .returning();
      assertSingleRow(after, `Model pricing ${params.id} retire failed`);

      const model = await this.getModel(after.model, tx);
      const metadata = getPlatformModelMetadata(model?.settings);
      await this.createAuditLog(tx, {
        action: 'platform_catalog_retire_pricing',
        metadata: {
          after: { status: after.status },
          before: { status: before.status },
          model: after.model,
          priceKey: after.priceKey,
          provider: NEWAPI_PROVIDER_ID,
          upstreamProvider: metadata.upstreamProvider,
        },
        reason: params.reason,
      });

      return after;
    });
  };
}
