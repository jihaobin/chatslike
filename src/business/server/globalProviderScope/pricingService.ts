import { and, desc, eq } from 'drizzle-orm';

import { modelPricing, type NewModelPricing, type UsageModality } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';

export interface ListProviderPricingParams {
  modality?: UsageModality;
  model: string;
  provider: string;
}

export interface CreateProviderPricingVersionParams extends ListProviderPricingParams {
  currency?: string;
  effectiveAt?: Date;
  fixedCreditsPerUnit?: number;
  inputCreditsPerMillionTokens?: number;
  outputCreditsPerMillionTokens?: number;
  parameterRules?: Record<string, unknown>;
  priceKey?: string;
  reason: string;
  unit?: string;
}

export class ProviderPricingService {
  constructor(private readonly db: LobeChatDatabase) {}

  listModelPricing = async (params: ListProviderPricingParams) => {
    const conditions = [eq(modelPricing.provider, params.provider), eq(modelPricing.model, params.model)];

    if (params.modality) conditions.push(eq(modelPricing.modality, params.modality));

    return this.db
      .select()
      .from(modelPricing)
      .where(and(...conditions))
      .orderBy(desc(modelPricing.effectiveAt), desc(modelPricing.createdAt));
  };

  createModelPricingVersion = async (params: CreateProviderPricingVersionParams) => {
    const modality = params.modality ?? 'text';
    const parameterRules = params.parameterRules ?? {};

    await this.db
      .update(modelPricing)
      .set({ status: 'retired', updatedAt: new Date() })
      .where(
        and(
          eq(modelPricing.provider, params.provider),
          eq(modelPricing.model, params.model),
          eq(modelPricing.modality, modality),
          eq(modelPricing.status, 'active'),
          eq(modelPricing.parameterRules, parameterRules),
        ),
      );

    const values: NewModelPricing = {
      currency: params.currency,
      effectiveAt: params.effectiveAt,
      fixedCreditsPerUnit: params.fixedCreditsPerUnit,
      inputCreditsPerMillionTokens: params.inputCreditsPerMillionTokens,
      modality,
      model: params.model,
      outputCreditsPerMillionTokens: params.outputCreditsPerMillionTokens,
      parameterRules,
      priceKey: params.priceKey ?? 'default',
      provider: params.provider,
      unit: params.unit,
    };

    const [result] = await this.db.insert(modelPricing).values(values).returning();
    return result;
  };

  retireModelPricingVersion = async (id: string) => {
    const [result] = await this.db
      .update(modelPricing)
      .set({ status: 'retired', updatedAt: new Date() })
      .where(eq(modelPricing.id, id))
      .returning();

    return result;
  };
}
