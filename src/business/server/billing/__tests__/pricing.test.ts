import { describe, expect, it } from 'vitest';

import {
  calculateImageCredits,
  calculateTextCredits,
  calculateVideoCredits,
  getInitialModelPricingRows,
  matchesParameterRules,
} from '../pricing';

describe('billing pricing', () => {
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
});
