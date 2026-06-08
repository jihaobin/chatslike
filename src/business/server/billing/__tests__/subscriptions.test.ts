import { describe, expect, it } from 'vitest';

import { SUBSCRIPTION_PLANS, SUBSCRIPTION_PRICE_CENTS } from '../constants';
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
        amountCents: SUBSCRIPTION_PRICE_CENTS.starter,
        creditsPerMonth: SUBSCRIPTION_PLANS.starter.creditsPerMonth,
        currency: 'CNY',
        id: 'starter',
        name: 'Starter',
        priceSource: 'temporary_test',
        purchasable: true,
      }),
      expect.objectContaining({
        amountCents: SUBSCRIPTION_PRICE_CENTS.premium,
        creditsPerMonth: SUBSCRIPTION_PLANS.premium.creditsPerMonth,
        currency: 'CNY',
        id: 'premium',
        name: 'Premium',
        priceSource: 'temporary_test',
        purchasable: true,
      }),
      expect.objectContaining({
        amountCents: SUBSCRIPTION_PRICE_CENTS.ultimate,
        creditsPerMonth: SUBSCRIPTION_PLANS.ultimate.creditsPerMonth,
        currency: 'CNY',
        id: 'ultimate',
        name: 'Ultimate',
        priceSource: 'temporary_test',
        purchasable: true,
      }),
    ]);
  });

  it('uses temporary RMB prices and monthly subscription credits', () => {
    expect(getSubscriptionPriceCents('starter', 'month')).toBe(
      SUBSCRIPTION_PRICE_CENTS.starter.month,
    );
    expect(getSubscriptionPriceCents('starter', 'year')).toBe(
      SUBSCRIPTION_PRICE_CENTS.starter.year,
    );
    expect(getSubscriptionCredits('premium', 'year')).toBe(
      SUBSCRIPTION_PLANS.premium.creditsPerMonth,
    );
  });

  it('calculates upgrade deltas for credits and price', () => {
    expect(
      calculateUpgradeCreditDelta({
        currentPlanId: 'starter',
        targetPlanId: 'premium',
      }),
    ).toBe(SUBSCRIPTION_PLANS.premium.creditsPerMonth - SUBSCRIPTION_PLANS.starter.creditsPerMonth);
    expect(
      calculateUpgradePriceDelta({
        currentPlanId: 'starter',
        period: 'month',
        targetPlanId: 'premium',
      }),
    ).toBe(SUBSCRIPTION_PRICE_CENTS.premium.month - SUBSCRIPTION_PRICE_CENTS.starter.month);
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
