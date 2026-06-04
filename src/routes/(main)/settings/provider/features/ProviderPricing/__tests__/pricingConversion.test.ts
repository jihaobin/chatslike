import { describe, expect, it } from 'vitest';

import {
  computeFixedMultiplierPricing,
  computeTokenMultiplierPricing,
  formatCreditRate,
  MILLION_CREDITS,
  toDisplayMillionCredits,
  toStoredMillionCredits,
} from '../pricingConversion';

describe('pricingConversion', () => {
  it('converts display million-credit value to stored credits', () => {
    expect(MILLION_CREDITS).toBe(1_000_000);
    expect(toStoredMillionCredits(5)).toBe(5_000_000);
    expect(toStoredMillionCredits(2.5)).toBe(2_500_000);
  });

  it('converts stored credits to display million-credit value', () => {
    expect(toDisplayMillionCredits(5_000_000)).toBe(5);
    expect(toDisplayMillionCredits(2_500_000)).toBe(2.5);
  });

  it('computes token multiplier pricing', () => {
    expect(
      computeTokenMultiplierPricing({ inputPrice: 5, multiplier: 0.5, outputPrice: 30 }),
    ).toEqual({
      inputCreditsPerMillionTokens: 2_500_000,
      outputCreditsPerMillionTokens: 15_000_000,
      providerCost: 35,
      sellRate: 0.5,
    });
  });

  it('computes fixed multiplier pricing', () => {
    expect(computeFixedMultiplierPricing({ multiplier: 0.5, price: 0.04, unit: 'image' })).toEqual({
      fixedCreditsPerUnit: 20_000,
      providerCost: 0.04,
      sellRate: 0.5,
      unit: 'image',
    });
  });

  it('formats credit rates for preview', () => {
    expect(formatCreditRate(2_500_000, 'millionTokens')).toBe('2.5M 积分 / M tokens');
    expect(formatCreditRate(20_000, 'image')).toBe('20,000 积分 / image');
  });
});
