import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { GLOBAL_PROVIDER_CONFIG_USER_ID } from '@/business/server/globalProviderScope/constants';
import { getTestDB } from '@/database/core/getTestDB';
import { aiModels, aiProviders, modelPricing, users } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';

import {
  calculateImageCredits,
  calculateTextCredits,
  calculateVideoCredits,
  getInitialModelPricingRows,
  listPublicTextModelPricingRows,
  matchesParameterRules,
} from '../pricing';

const serverDB: LobeChatDatabase = await getTestDB();

const clearData = async () => {
  await serverDB.delete(modelPricing);
  await serverDB.delete(aiModels);
  await serverDB.delete(aiProviders);
  await serverDB.delete(users);
};

describe('billing pricing', () => {
  beforeEach(async () => {
    await clearData();
    await serverDB
      .insert(users)
      .values({ id: GLOBAL_PROVIDER_CONFIG_USER_ID })
      .onConflictDoNothing();
  });

  afterEach(async () => {
    await clearData();
  });

  it('calculates text credits from input and output tokens', () => {
    expect(
      calculateTextCredits({
        inputCreditsPerMillionTokens: 2_000_000,
        inputTokens: 1000,
        outputCreditsPerMillionTokens: 8_000_000,
        outputTokens: 500,
      }),
    ).toBe(6000);
  });

  it('rounds text credits up to avoid undercharging fractional token costs', () => {
    expect(
      calculateTextCredits({
        inputCreditsPerMillionTokens: 280_000,
        inputTokens: 1,
        outputCreditsPerMillionTokens: 1_100_000,
        outputTokens: 1,
      }),
    ).toBe(2);
  });

  it('calculates image credits by count and fixed unit price', () => {
    expect(calculateImageCredits({ fixedCreditsPerUnit: 40_000, imageNum: 2 })).toBe(80_000);
  });

  it('calculates video credits by task duration units', () => {
    expect(calculateVideoCredits({ durationSeconds: 5, fixedCreditsPerSecond: 20_000 })).toBe(
      100_000,
    );
  });

  it('contains initial LobeHub-like model pricing rows', () => {
    expect(getInitialModelPricingRows()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          inputCreditsPerMillionTokens: 2_000_000,
          model: 'gpt-4.1',
          outputCreditsPerMillionTokens: 8_000_000,
          provider: 'openai',
        }),
        expect.objectContaining({
          fixedCreditsPerUnit: 40_000,
          modality: 'image',
          model: 'dall-e-3',
        }),
      ]),
    );
  });

  it('marks parameterized image pricing rows with distinct price keys', () => {
    const rows = getInitialModelPricingRows().filter(
      (row) => row.provider === 'openai' && row.model === 'dall-e-3' && row.modality === 'image',
    );

    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row) => row.priceKey)).size).toBe(2);
  });

  it('matches parameter rules against generation params', () => {
    expect(
      matchesParameterRules(
        { quality: 'standard', size: '1792x1024' },
        { quality: 'standard', size: '1792x1024' },
      ),
    ).toBe(true);
    expect(
      matchesParameterRules(
        { quality: 'standard', size: '1024x1024' },
        { quality: 'standard', size: '1792x1024' },
      ),
    ).toBe(false);
  });

  it('lists enabled global platform text models with active pricing for public plan display', async () => {
    await serverDB.insert(aiProviders).values([
      {
        enabled: true,
        id: 'newapi-openai-relay',
        name: 'OpenAI Relay',
        source: 'custom',
        sort: 1,
        userId: GLOBAL_PROVIDER_CONFIG_USER_ID,
      },
      {
        enabled: false,
        id: 'disabled-relay',
        name: 'Disabled Relay',
        source: 'custom',
        sort: 2,
        userId: GLOBAL_PROVIDER_CONFIG_USER_ID,
      },
    ]);
    await serverDB.insert(aiModels).values([
      {
        contextWindowTokens: 128_000,
        displayName: 'GPT 4.1',
        enabled: true,
        id: 'gpt-4.1',
        providerId: 'newapi-openai-relay',
        source: 'custom',
        type: 'chat',
        userId: GLOBAL_PROVIDER_CONFIG_USER_ID,
      },
      {
        displayName: 'Disabled Claude',
        enabled: false,
        id: 'claude-disabled',
        providerId: 'newapi-openai-relay',
        source: 'custom',
        type: 'chat',
        userId: GLOBAL_PROVIDER_CONFIG_USER_ID,
      },
      {
        displayName: 'Disabled Provider Model',
        enabled: true,
        id: 'disabled-provider-model',
        providerId: 'disabled-relay',
        source: 'custom',
        type: 'chat',
        userId: GLOBAL_PROVIDER_CONFIG_USER_ID,
      },
      {
        displayName: 'Image Model',
        enabled: true,
        id: 'image-model',
        providerId: 'newapi-openai-relay',
        source: 'custom',
        type: 'image',
        userId: GLOBAL_PROVIDER_CONFIG_USER_ID,
      },
    ]);
    await serverDB.insert(modelPricing).values([
      {
        effectiveAt: new Date('2026-01-01T00:00:00Z'),
        inputCreditsPerMillionTokens: 1_000,
        modality: 'text',
        model: 'gpt-4.1',
        outputCreditsPerMillionTokens: 2_000,
        priceKey: 'old',
        provider: 'newapi-openai-relay',
        status: 'active',
      },
      {
        effectiveAt: new Date('2026-02-01T00:00:00Z'),
        inputCreditsPerMillionTokens: 3_000,
        modality: 'text',
        model: 'gpt-4.1',
        outputCreditsPerMillionTokens: 4_000,
        priceKey: 'current',
        provider: 'newapi-openai-relay',
        status: 'active',
      },
      {
        effectiveAt: new Date('2026-02-01T00:00:00Z'),
        inputCreditsPerMillionTokens: 5_000,
        modality: 'text',
        model: 'claude-disabled',
        outputCreditsPerMillionTokens: 6_000,
        priceKey: 'disabled',
        provider: 'newapi-openai-relay',
        status: 'active',
      },
      {
        effectiveAt: new Date('2026-02-01T00:00:00Z'),
        inputCreditsPerMillionTokens: 7_000,
        modality: 'text',
        model: 'disabled-provider-model',
        outputCreditsPerMillionTokens: 8_000,
        priceKey: 'disabled-provider',
        provider: 'disabled-relay',
        status: 'active',
      },
      {
        fixedCreditsPerUnit: 7_000,
        modality: 'image',
        model: 'image-model',
        priceKey: 'image',
        provider: 'newapi-openai-relay',
        status: 'active',
      },
    ]);

    await expect(listPublicTextModelPricingRows(serverDB)).resolves.toEqual([
      {
        contextWindowTokens: 128_000,
        displayName: 'GPT 4.1',
        id: 'text:gpt-4.1',
        inputCreditsPerMillionTokens: 3_000,
        model: 'gpt-4.1',
        outputCreditsPerMillionTokens: 4_000,
        provider: 'newapi-openai-relay',
      },
    ]);
  });
});
