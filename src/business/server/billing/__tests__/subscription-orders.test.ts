// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  calculateUpgradeCreditDelta,
  calculateUpgradePriceDelta,
  getSubscriptionCredits,
  getSubscriptionPriceCents,
} from '../subscriptions';

describe('subscription order helpers', () => {
  it('uses temporary RMB subscription prices', () => {
    expect(getSubscriptionPriceCents('starter', 'month')).toBe(9900);
    expect(getSubscriptionPriceCents('starter', 'year')).toBe(99_000);
    expect(getSubscriptionPriceCents('premium', 'month')).toBe(24_900);
    expect(getSubscriptionPriceCents('ultimate', 'year')).toBe(499_000);
  });

  it('keeps yearly subscription grant amount to the monthly quota', () => {
    expect(getSubscriptionCredits('premium', 'year')).toBe(15_000_000);
  });

  it('grants only quota difference when upgrading immediately', () => {
    expect(
      calculateUpgradeCreditDelta({
        currentPlanId: 'starter',
        targetPlanId: 'premium',
      }),
    ).toBe(10_000_000);
  });

  it('charges only the plan price difference when upgrading immediately', () => {
    expect(
      calculateUpgradePriceDelta({
        currentPlanId: 'premium',
        period: 'month',
        targetPlanId: 'ultimate',
      }),
    ).toBe(25_000);
  });
});
