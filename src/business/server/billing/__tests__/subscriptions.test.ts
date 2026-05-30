import { describe, expect, it } from 'vitest';

import {
  calculateUpgradeCreditDelta,
  calculateUpgradePriceDelta,
  getSubscriptionCredits,
  getSubscriptionPriceCents,
  getSubscriptionValidUntil,
  listSubscriptionPlans,
} from '../subscriptions';

describe('subscriptions', () => {
  it('returns starter premium ultimate credits in RMB display mode', () => {
    expect(listSubscriptionPlans()).toEqual([
      expect.objectContaining({
        creditsPerMonth: 5_000_000,
        currency: 'CNY',
        id: 'starter',
        name: 'Starter',
        priceSource: 'temporary_test',
        purchasable: true,
      }),
      expect.objectContaining({
        amountCents: { month: 24_900, year: 249_000 },
        creditsPerMonth: 15_000_000,
        currency: 'CNY',
        id: 'premium',
        name: 'Premium',
        priceSource: 'temporary_test',
        purchasable: true,
      }),
      expect.objectContaining({
        amountCents: { month: 49_900, year: 499_000 },
        creditsPerMonth: 35_000_000,
        currency: 'CNY',
        id: 'ultimate',
        name: 'Ultimate',
        priceSource: 'temporary_test',
        purchasable: true,
      }),
    ]);
  });

  it('uses temporary RMB prices and monthly subscription credits', () => {
    expect(getSubscriptionPriceCents('starter', 'month')).toBe(9900);
    expect(getSubscriptionPriceCents('starter', 'year')).toBe(99_000);
    expect(getSubscriptionCredits('premium', 'year')).toBe(15_000_000);
  });

  it('calculates upgrade deltas for credits and price', () => {
    expect(
      calculateUpgradeCreditDelta({
        currentPlanId: 'starter',
        targetPlanId: 'premium',
      }),
    ).toBe(10_000_000);
    expect(
      calculateUpgradePriceDelta({
        currentPlanId: 'starter',
        period: 'month',
        targetPlanId: 'premium',
      }),
    ).toBe(15_000);
  });

  it('extends renewal validity from the current period end', () => {
    expect(
      getSubscriptionValidUntil({
        currentPeriodEnd: new Date('2026-06-15T00:00:00.000Z'),
        now: new Date('2026-05-28T00:00:00.000Z'),
        period: 'month',
      }).toISOString(),
    ).toBe('2026-07-15T00:00:00.000Z');
  });
});
