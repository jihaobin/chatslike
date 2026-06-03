// @vitest-environment node
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '@/database/core/getTestDB';
import { adminAuditLogs, aiModels, aiProviders, modelPricing, users } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';

import { NEWAPI_PROVIDER_ID, PLATFORM_CATALOG_USER_ID } from '../constants';
import { PlatformCatalogService } from '../service';

const serverDB: LobeChatDatabase = await getTestDB();
const adminUserId = 'platform-catalog-admin';

const clearData = async () => {
  await serverDB.delete(adminAuditLogs);
  await serverDB.delete(modelPricing);
  await serverDB.delete(aiModels);
  await serverDB.delete(aiProviders);
  await serverDB.delete(users);
};

const insertUsers = async () => {
  await serverDB
    .insert(users)
    .values([{ id: adminUserId, role: 'admin' }, { id: PLATFORM_CATALOG_USER_ID }])
    .onConflictDoNothing();
};

const seedProvider = async (enabled = true) => {
  await serverDB.insert(aiProviders).values({
    enabled,
    id: NEWAPI_PROVIDER_ID,
    name: 'New API',
    source: 'builtin',
    userId: PLATFORM_CATALOG_USER_ID,
  });
};

const seedModels = async () => {
  await serverDB.insert(aiModels).values([
    {
      abilities: { reasoning: true },
      contextWindowTokens: 128_000,
      displayName: 'GPT 4.1',
      enabled: true,
      id: 'gpt-4.1',
      providerId: NEWAPI_PROVIDER_ID,
      settings: { upstreamDisplayName: 'OpenAI', upstreamProvider: 'openai' },
      sort: 1,
      source: 'builtin',
      type: 'chat',
      userId: PLATFORM_CATALOG_USER_ID,
    },
    {
      displayName: 'Claude Sonnet',
      enabled: false,
      id: 'claude-3-7-sonnet',
      providerId: NEWAPI_PROVIDER_ID,
      settings: { upstreamDisplayName: 'Anthropic', upstreamProvider: 'anthropic' },
      source: 'builtin',
      type: 'chat',
      userId: PLATFORM_CATALOG_USER_ID,
    },
  ]);
};

beforeEach(async () => {
  await clearData();
  await insertUsers();
});

afterEach(async () => {
  await clearData();
});

describe('PlatformCatalogService', () => {
  it('returns New API status metrics with credential, pricing gap, and scheduled pricing counts', async () => {
    await seedProvider(true);
    await seedModels();
    await serverDB.insert(modelPricing).values([
      {
        inputCreditsPerMillionTokens: 1_000,
        modality: 'text',
        model: 'gpt-4.1',
        outputCreditsPerMillionTokens: 2_000,
        priceKey: 'current',
        provider: NEWAPI_PROVIDER_ID,
        status: 'active',
      },
      {
        inputCreditsPerMillionTokens: 2_000,
        modality: 'text',
        model: 'gpt-4.1',
        outputCreditsPerMillionTokens: 4_000,
        priceKey: 'future',
        provider: NEWAPI_PROVIDER_ID,
        effectiveAt: new Date(Date.now() + 86_400_000),
        status: 'active',
      },
    ]);

    const service = new PlatformCatalogService(serverDB, adminUserId, {
      NEWAPI_API_KEY: 'key',
      NEWAPI_PROXY_URL: 'https://newapi.example.com',
    });

    await expect(service.getNewApiProviderStatus()).resolves.toMatchObject({
      credentialStatus: {
        configured: true,
        missingKeys: [],
      },
      enabled: true,
      enabledModelCount: 1,
      futurePricingCount: 1,
      modelCount: 2,
      pricingGapCount: 1,
      provider: NEWAPI_PROVIDER_ID,
    });
  });

  it('upserts New API provider status and writes an audit log', async () => {
    const service = new PlatformCatalogService(serverDB, adminUserId);

    await service.updateNewApiProviderStatus({ enabled: false, reason: 'maintenance' });

    const [provider] = await serverDB
      .select()
      .from(aiProviders)
      .where(
        and(
          eq(aiProviders.id, NEWAPI_PROVIDER_ID),
          eq(aiProviders.userId, PLATFORM_CATALOG_USER_ID),
        ),
      );
    expect(provider).toMatchObject({
      enabled: false,
      id: NEWAPI_PROVIDER_ID,
      source: 'builtin',
    });

    const [audit] = await serverDB.select().from(adminAuditLogs);
    expect(audit).toMatchObject({
      action: 'platform_catalog_update_provider',
      adminUserId,
      reason: 'maintenance',
    });
    expect(audit.metadata).toMatchObject({
      after: { enabled: false },
      provider: NEWAPI_PROVIDER_ID,
    });
  });

  it('lists New API models with upstream metadata', async () => {
    await seedProvider();
    await seedModels();

    const service = new PlatformCatalogService(serverDB, adminUserId);
    const models = await service.listPlatformModels({ upstreamProvider: 'openai' });

    expect(models).toHaveLength(1);
    expect(models[0]).toMatchObject({
      displayName: 'GPT 4.1',
      id: 'gpt-4.1',
      providerId: NEWAPI_PROVIDER_ID,
      upstreamDisplayName: 'OpenAI',
      upstreamProvider: 'openai',
    });
  });

  it('updates editable model fields and upstream metadata without changing provider identity', async () => {
    await seedProvider();
    await seedModels();
    const service = new PlatformCatalogService(serverDB, adminUserId);

    await service.updatePlatformModel({
      contextWindowTokens: 200_000,
      displayName: 'GPT 4.1 Managed',
      model: 'gpt-4.1',
      reason: 'catalog polish',
      settings: { disabledParams: ['temperature'], upstreamProvider: 'should-be-overridden' },
      sort: 7,
      upstreamDisplayName: 'OpenAI',
      upstreamProvider: 'openai-chat',
    });

    const [model] = await serverDB
      .select()
      .from(aiModels)
      .where(
        and(
          eq(aiModels.id, 'gpt-4.1'),
          eq(aiModels.providerId, NEWAPI_PROVIDER_ID),
          eq(aiModels.userId, PLATFORM_CATALOG_USER_ID),
        ),
      );

    expect(model).toMatchObject({
      contextWindowTokens: 200_000,
      displayName: 'GPT 4.1 Managed',
      providerId: NEWAPI_PROVIDER_ID,
      sort: 7,
    });
    expect(model.settings).toMatchObject({
      disabledParams: ['temperature'],
      upstreamDisplayName: 'OpenAI',
      upstreamProvider: 'openai-chat',
    });
  });

  it('toggles model enabled state with before and after audit metadata', async () => {
    await seedProvider();
    await seedModels();
    const service = new PlatformCatalogService(serverDB, adminUserId);

    await service.togglePlatformModelEnabled({
      enabled: false,
      model: 'gpt-4.1',
      reason: 'quality incident',
    });

    const [model] = await serverDB.select().from(aiModels).where(eq(aiModels.id, 'gpt-4.1'));
    expect(model.enabled).toBe(false);

    const [audit] = await serverDB.select().from(adminAuditLogs);
    expect(audit.metadata).toMatchObject({
      after: { enabled: false },
      before: { enabled: true },
      model: 'gpt-4.1',
      provider: NEWAPI_PROVIDER_ID,
      upstreamProvider: 'openai',
    });
  });

  it('creates future pricing versions without overwriting the current price', async () => {
    await seedProvider();
    await seedModels();
    await serverDB.insert(modelPricing).values({
      inputCreditsPerMillionTokens: 1_000,
      modality: 'text',
      model: 'gpt-4.1',
      outputCreditsPerMillionTokens: 2_000,
      priceKey: 'current',
      provider: NEWAPI_PROVIDER_ID,
      status: 'active',
    });
    const effectiveAt = new Date(Date.now() + 3_600_000);
    const service = new PlatformCatalogService(serverDB, adminUserId);

    await service.createModelPricingVersion({
      effectiveAt,
      inputCreditsPerMillionTokens: 3_000,
      modality: 'text',
      model: 'gpt-4.1',
      outputCreditsPerMillionTokens: 6_000,
      priceKey: 'scheduled',
      reason: 'scheduled price update',
    });

    const prices = await serverDB
      .select()
      .from(modelPricing)
      .where(and(eq(modelPricing.provider, NEWAPI_PROVIDER_ID), eq(modelPricing.model, 'gpt-4.1')));
    expect(prices).toHaveLength(2);
    expect(prices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ priceKey: 'current', provider: NEWAPI_PROVIDER_ID }),
        expect.objectContaining({
          effectiveAt,
          priceKey: 'scheduled',
          provider: NEWAPI_PROVIDER_ID,
        }),
      ]),
    );
  });

  it('retires only the selected pricing version and writes audit metadata', async () => {
    await seedProvider();
    await seedModels();
    const [retiredTarget, stillActive] = await serverDB
      .insert(modelPricing)
      .values([
        {
          fixedCreditsPerUnit: 10_000,
          modality: 'image',
          model: 'gpt-4.1',
          priceKey: 'image-default',
          provider: NEWAPI_PROVIDER_ID,
          status: 'active',
          unit: 'image',
        },
        {
          inputCreditsPerMillionTokens: 1_000,
          modality: 'text',
          model: 'gpt-4.1',
          outputCreditsPerMillionTokens: 2_000,
          priceKey: 'text-default',
          provider: NEWAPI_PROVIDER_ID,
          status: 'active',
        },
      ])
      .returning();
    const service = new PlatformCatalogService(serverDB, adminUserId);

    await service.retireModelPricingVersion({
      id: retiredTarget.id,
      reason: 'bad image rate',
    });

    const prices = await serverDB.select().from(modelPricing);
    expect(prices.find((price) => price.id === retiredTarget.id)?.status).toBe('retired');
    expect(prices.find((price) => price.id === stillActive.id)?.status).toBe('active');

    const [audit] = await serverDB.select().from(adminAuditLogs);
    expect(audit.metadata).toMatchObject({
      after: { status: 'retired' },
      before: { status: 'active' },
      model: 'gpt-4.1',
      priceKey: 'image-default',
      provider: NEWAPI_PROVIDER_ID,
    });
  });
});
