// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { subscriptionRouter } from '../subscription';

const {
  createRenewOrder,
  createSubscriptionOrder,
  createUpgradeOrder,
  getCurrentSubscription,
  listPublicTextModelPricingRows,
  listSubscriptionPlans,
  mockDb,
} = vi.hoisted(() => ({
  createRenewOrder: vi.fn(),
  createSubscriptionOrder: vi.fn(),
  createUpgradeOrder: vi.fn(),
  getCurrentSubscription: vi.fn(),
  listPublicTextModelPricingRows: vi.fn(),
  listSubscriptionPlans: vi.fn(),
  mockDb: {},
}));

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn(async () => mockDb),
}));

vi.mock('@/business/server/billing/subscriptions', () => ({
  getCurrentSubscription,
  listSubscriptionPlans,
}));

vi.mock('@/business/server/billing/pricing', () => ({
  listPublicTextModelPricingRows,
}));

vi.mock('@/business/server/billing/orders', () => ({
  BillingOrderService: vi.fn().mockImplementation(() => ({
    createRenewOrder,
    createSubscriptionOrder,
    createUpgradeOrder,
  })),
}));

describe('subscriptionRouter', () => {
  beforeEach(() => {
    createRenewOrder.mockReset();
    createSubscriptionOrder.mockReset();
    createUpgradeOrder.mockReset();
    getCurrentSubscription.mockReset();
    listPublicTextModelPricingRows.mockReset();
    listSubscriptionPlans.mockReset();
  });

  it('lists purchasable subscription plans', async () => {
    listSubscriptionPlans.mockReturnValue([
      {
        amountCents: { month: 9900, year: 99_000 },
        id: 'starter',
        priceSource: 'temporary_test',
        purchasable: true,
      },
    ]);
    const caller = subscriptionRouter.createCaller({ userId: 'user-1' });

    await expect(caller.listPlans()).resolves.toEqual([
      {
        amountCents: { month: 9900, year: 99_000 },
        id: 'starter',
        priceSource: 'temporary_test',
        purchasable: true,
      },
    ]);
  });

  it('lists text model pricing rows', async () => {
    listPublicTextModelPricingRows.mockResolvedValue([
      {
        contextWindowTokens: 1_000_000,
        displayName: 'DeepSeek V4 Pro',
        id: 'text:deepseek-v4-pro',
        inputCreditsPerMillionTokens: 435_000,
        model: 'deepseek-v4-pro',
        outputCreditsPerMillionTokens: 870_000,
        provider: 'deepseek',
      },
    ]);
    const caller = subscriptionRouter.createCaller({ userId: 'user-1' });

    await expect(caller.listTextModelPricing()).resolves.toEqual([
      {
        contextWindowTokens: 1_000_000,
        displayName: 'DeepSeek V4 Pro',
        id: 'text:deepseek-v4-pro',
        inputCreditsPerMillionTokens: 435_000,
        model: 'deepseek-v4-pro',
        outputCreditsPerMillionTokens: 870_000,
        provider: 'deepseek',
      },
    ]);
    expect(listPublicTextModelPricingRows).toHaveBeenCalledWith(mockDb);
  });

  it('creates a new subscription order', async () => {
    createSubscriptionOrder.mockResolvedValue({
      order: { id: 'order-1', orderType: 'subscription_new' },
      payment: { channel: 'alipay', qrCodeUrl: '/pay/order-1' },
    });
    const caller = subscriptionRouter.createCaller({ userId: 'user-1' });

    await expect(
      caller.createSubscriptionOrder({
        channel: 'alipay',
        period: 'month',
        planId: 'starter',
      }),
    ).resolves.toMatchObject({ order: { id: 'order-1' } });
    expect(createSubscriptionOrder).toHaveBeenCalledWith({
      channel: 'alipay',
      period: 'month',
      planId: 'starter',
    });
  });

  it('creates a subscription renewal order', async () => {
    createRenewOrder.mockResolvedValue({
      order: { id: 'renew-order', orderType: 'subscription_renew' },
      payment: { channel: 'wechat', qrCodeUrl: '/pay/renew-order' },
    });
    const caller = subscriptionRouter.createCaller({ userId: 'user-1' });

    await expect(
      caller.createRenewOrder({
        channel: 'wechat',
        period: 'year',
        planId: 'premium',
      }),
    ).resolves.toMatchObject({ order: { id: 'renew-order' } });
    expect(createRenewOrder).toHaveBeenCalledWith({
      channel: 'wechat',
      period: 'year',
      planId: 'premium',
    });
  });

  it('creates a subscription upgrade order', async () => {
    createUpgradeOrder.mockResolvedValue({
      order: { id: 'upgrade-order', orderType: 'subscription_upgrade' },
      payment: { channel: 'alipay', qrCodeUrl: '/pay/upgrade-order' },
    });
    const caller = subscriptionRouter.createCaller({ userId: 'user-1' });

    await expect(
      caller.createUpgradeOrder({
        channel: 'alipay',
        targetPlanId: 'ultimate',
      }),
    ).resolves.toMatchObject({ order: { id: 'upgrade-order' } });
    expect(createUpgradeOrder).toHaveBeenCalledWith({
      channel: 'alipay',
      targetPlanId: 'ultimate',
    });
  });

  it('returns the current active subscription', async () => {
    getCurrentSubscription.mockResolvedValue({
      currentPeriodEnd: new Date('2026-07-01T00:00:00.000Z'),
      currentPeriodStart: new Date('2026-06-01T00:00:00.000Z'),
      orderId: 'current-order',
      period: 'month',
      planId: 'premium',
    });
    const caller = subscriptionRouter.createCaller({ userId: 'user-1' });

    await expect(caller.getCurrent()).resolves.toMatchObject({
      orderId: 'current-order',
      planId: 'premium',
    });
    expect(getCurrentSubscription).toHaveBeenCalledWith(mockDb, 'user-1');
  });
});
