// @vitest-environment node
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '@/database/core/getTestDB';
import { aiModels, aiProviders, modelPricing, users } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';

import { BillingError, PricingNotFoundError } from '../../billing/errors';
import { NEWAPI_PROVIDER_ID, PLATFORM_CATALOG_USER_ID } from '../constants';
import { assertNewApiPlatformModelAvailable } from '../runtimeGuard';

const serverDB: LobeChatDatabase = await getTestDB();

const clearData = async () => {
  await serverDB.delete(modelPricing);
  await serverDB.delete(aiModels);
  await serverDB.delete(aiProviders);
  await serverDB.delete(users);
};

const seedCatalog = async (params: { modelEnabled?: boolean; providerEnabled?: boolean } = {}) => {
  await serverDB.insert(users).values({ id: PLATFORM_CATALOG_USER_ID }).onConflictDoNothing();
  await serverDB.insert(aiProviders).values({
    enabled: params.providerEnabled ?? true,
    id: NEWAPI_PROVIDER_ID,
    source: 'builtin',
    userId: PLATFORM_CATALOG_USER_ID,
  });
  await serverDB.insert(aiModels).values({
    enabled: params.modelEnabled ?? true,
    id: 'gpt-4.1',
    providerId: NEWAPI_PROVIDER_ID,
    source: 'builtin',
    type: 'chat',
    userId: PLATFORM_CATALOG_USER_ID,
  });
};

const expectBillingCode = async (promise: Promise<unknown>, code: string) => {
  await expect(promise).rejects.toMatchObject({ code });
  await expect(promise).rejects.toBeInstanceOf(BillingError);
};

beforeEach(async () => {
  await clearData();
});

afterEach(async () => {
  await clearData();
});

describe('assertNewApiPlatformModelAvailable', () => {
  it('throws when New API provider is disabled', async () => {
    await seedCatalog({ providerEnabled: false });

    await expectBillingCode(
      assertNewApiPlatformModelAvailable({
        db: serverDB,
        llmConfig: { NEWAPI_API_KEY: 'key', NEWAPI_PROXY_URL: 'https://newapi.example.com' },
        model: 'gpt-4.1',
        userId: 'user-1',
      }),
      'PLATFORM_PROVIDER_DISABLED',
    );
  });

  it('throws when model is missing or disabled', async () => {
    await seedCatalog({ modelEnabled: false });

    await expectBillingCode(
      assertNewApiPlatformModelAvailable({
        db: serverDB,
        llmConfig: { NEWAPI_API_KEY: 'key', NEWAPI_PROXY_URL: 'https://newapi.example.com' },
        model: 'gpt-4.1',
        userId: 'user-1',
      }),
      'PLATFORM_MODEL_DISABLED',
    );

    await serverDB
      .delete(aiModels)
      .where(
        and(
          eq(aiModels.id, 'gpt-4.1'),
          eq(aiModels.providerId, NEWAPI_PROVIDER_ID),
          eq(aiModels.userId, PLATFORM_CATALOG_USER_ID),
        ),
      );

    await expectBillingCode(
      assertNewApiPlatformModelAvailable({
        db: serverDB,
        llmConfig: { NEWAPI_API_KEY: 'key', NEWAPI_PROXY_URL: 'https://newapi.example.com' },
        model: 'gpt-4.1',
        userId: 'user-1',
      }),
      'PLATFORM_MODEL_DISABLED',
    );
  });

  it('throws when New API credential is missing', async () => {
    await seedCatalog();

    await expectBillingCode(
      assertNewApiPlatformModelAvailable({
        db: serverDB,
        llmConfig: { NEWAPI_API_KEY: '', NEWAPI_PROXY_URL: 'https://newapi.example.com' },
        model: 'gpt-4.1',
        userId: 'user-1',
      }),
      'PLATFORM_MODEL_CREDENTIAL_MISSING',
    );
  });

  it('throws PricingNotFoundError when pricing is required but missing', async () => {
    await seedCatalog();

    await expect(
      assertNewApiPlatformModelAvailable({
        db: serverDB,
        llmConfig: { NEWAPI_API_KEY: 'key', NEWAPI_PROXY_URL: 'https://newapi.example.com' },
        modality: 'text',
        model: 'gpt-4.1',
        requirePricing: true,
        userId: 'user-1',
      }),
    ).rejects.toBeInstanceOf(PricingNotFoundError);
  });

  it('passes when provider, model, credential, and pricing are available', async () => {
    await seedCatalog();
    await serverDB.insert(modelPricing).values({
      inputCreditsPerMillionTokens: 1_000,
      modality: 'text',
      model: 'gpt-4.1',
      outputCreditsPerMillionTokens: 2_000,
      priceKey: 'current',
      provider: NEWAPI_PROVIDER_ID,
      status: 'active',
    });

    await expect(
      assertNewApiPlatformModelAvailable({
        db: serverDB,
        llmConfig: { NEWAPI_API_KEY: 'key', NEWAPI_PROXY_URL: 'https://newapi.example.com' },
        modality: 'text',
        model: 'gpt-4.1',
        requirePricing: true,
        userId: 'user-1',
      }),
    ).resolves.toBeUndefined();
  });
});
