// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BillingOrderService } from '../orders';

const {
  closePendingOrder,
  createOrder,
  createPayment,
  createPendingTransaction,
  findOrderById,
  findTransactionByProviderTransactionId,
  grantSubscriptionCredits,
  grantTopUpCredits,
  recordPaymentCallback,
  updateOrderStatus,
} = vi.hoisted(() => ({
  closePendingOrder: vi.fn(),
  createOrder: vi.fn(),
  createPayment: vi.fn(),
  createPendingTransaction: vi.fn(),
  findOrderById: vi.fn(),
  findTransactionByProviderTransactionId: vi.fn(),
  grantSubscriptionCredits: vi.fn(),
  grantTopUpCredits: vi.fn(),
  recordPaymentCallback: vi.fn(),
  updateOrderStatus: vi.fn(),
}));

vi.mock('@/database/models/billing', () => ({
  BillingOrderModel: vi.fn().mockImplementation(() => ({
    closePending: closePendingOrder,
    create: createOrder,
    findById: findOrderById,
    list: vi.fn(),
    updateStatus: updateOrderStatus,
  })),
  PaymentTransactionModel: vi.fn().mockImplementation(() => ({
    createPending: createPendingTransaction,
    findByProviderTransactionId: findTransactionByProviderTransactionId,
    recordCallback: recordPaymentCallback,
  })),
}));

vi.mock('../credits', () => ({
  CreditsService: vi.fn().mockImplementation(() => ({
    grantSubscriptionCredits,
    grantTopUpCredits,
  })),
}));

vi.mock('../payments', () => ({
  getPaymentAdapter: vi.fn(() => ({
    createPayment,
  })),
}));

const pendingOrder = {
  amountCents: 9900,
  credits: 1_000_000,
  id: 'order-1',
  orderType: 'top_up',
  status: 'pending',
};

const succeededTransaction = {
  amountCents: 9900,
  billingOrderId: 'order-1',
  channel: 'alipay',
  id: 'payment-1',
  signatureVerified: true,
  status: 'succeeded',
};

describe('BillingOrderService', () => {
  beforeEach(() => {
    closePendingOrder.mockReset();
    createOrder.mockReset();
    createPayment.mockReset();
    createPendingTransaction.mockReset();
    findOrderById.mockReset();
    findTransactionByProviderTransactionId.mockReset();
    grantSubscriptionCredits.mockReset();
    grantTopUpCredits.mockReset();
    recordPaymentCallback.mockReset();
    updateOrderStatus.mockReset();
    createPendingTransaction.mockResolvedValue({ id: 'payment-created' });
    findTransactionByProviderTransactionId.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a top-up order from a configured product', async () => {
    createOrder.mockResolvedValue({ ...pendingOrder, paymentChannel: 'alipay' });
    createPayment.mockResolvedValue({ channel: 'alipay', qrCodeUrl: '/pay/order-1' });
    const service = new BillingOrderService({} as never, 'user-1');

    const result = await service.createTopUpOrder({
      channel: 'alipay',
      productId: 'topup_1m',
    });

    expect(createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCents: 9900,
        credits: 1_000_000,
        metadata: expect.objectContaining({
          priceSource: 'temporary_test',
        }),
        orderType: 'top_up',
        paymentChannel: 'alipay',
        status: 'pending',
      }),
    );
    expect(createPayment).toHaveBeenCalledWith({
      amountCents: 9900,
      channel: 'alipay',
      description: '1,000,000 Credits',
      orderId: 'order-1',
    });
    expect(createPendingTransaction).toHaveBeenCalledWith({
      amountCents: 9900,
      billingOrderId: 'order-1',
      channel: 'alipay',
      providerTransactionId: undefined,
    });
    expect(result.order).toMatchObject({ amountCents: 9900, credits: 1_000_000 });
    expect(result.payment).toMatchObject({ qrCodeUrl: '/pay/order-1', transactionId: 'payment-created' });
  });

  it('closes the pending order when payment creation fails', async () => {
    createOrder.mockResolvedValue({ ...pendingOrder, paymentChannel: 'alipay' });
    createPayment.mockRejectedValue(new Error('payment not configured'));
    closePendingOrder.mockResolvedValue({ ...pendingOrder, status: 'closed' });
    const service = new BillingOrderService({} as never, 'user-1');

    await expect(
      service.createTopUpOrder({
        channel: 'alipay',
        productId: 'topup_1m',
      }),
    ).rejects.toThrow('payment not configured');
    expect(closePendingOrder).toHaveBeenCalledWith('order-1');
  });

  it('creates a new subscription order with temporary RMB pricing', async () => {
    const order = {
      amountCents: 9900,
      credits: 5_000_000,
      currency: 'CNY',
      id: 'subscription-order-1',
      orderType: 'subscription_new',
      status: 'pending',
    };
    createOrder.mockResolvedValue(order);
    createPayment.mockResolvedValue({
      channel: 'alipay',
      qrCodeUrl: '/pay/subscription-order-1',
    });
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(async () => []),
          })),
        })),
      })),
    };
    const service = new BillingOrderService(db as never, 'user-1');

    const result = await service.createSubscriptionOrder({
      channel: 'alipay',
      period: 'month',
      planId: 'starter',
    });

    expect(createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCents: 9900,
        credits: 5_000_000,
        currency: 'CNY',
        orderType: 'subscription_new',
        paymentChannel: 'alipay',
        period: 'month',
        planId: 'starter',
        status: 'pending',
      }),
    );
    expect(createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { planName: 'Starter', priceSource: 'temporary_test' },
      }),
    );
    expect(createPayment).toHaveBeenCalledWith({
      amountCents: 9900,
      channel: 'alipay',
      description: 'Starter month subscription',
      orderId: 'subscription-order-1',
    });
    expect(result.order).toBe(order);
  });

  it('creates a renewal order only for the active current plan', async () => {
    const currentPeriodEnd = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(async () => [
              {
                activatedAt: new Date(),
                createdAt: new Date(),
                id: 'current-order',
                metadata: { validUntil: currentPeriodEnd.toISOString() },
                orderType: 'subscription_new',
                period: 'month',
                planId: 'premium',
                status: 'activated',
                userId: 'user-1',
              },
            ]),
          })),
        })),
      })),
    };
    const renewalOrder = {
      amountCents: 249_000,
      credits: 15_000_000,
      id: 'renew-order',
      orderType: 'subscription_renew',
      status: 'pending',
    };
    createOrder.mockResolvedValue(renewalOrder);
    createPayment.mockResolvedValue({ channel: 'wechat', qrCodeUrl: '/pay/renew-order' });
    const service = new BillingOrderService(db as never, 'user-1');

    const result = await service.createRenewOrder({
      channel: 'wechat',
      period: 'year',
      planId: 'premium',
    });

    expect(createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCents: 249_000,
        credits: 15_000_000,
        metadata: expect.objectContaining({
          currentPeriodEnd: currentPeriodEnd.toISOString(),
          priceSource: 'temporary_test',
          validFrom: currentPeriodEnd.toISOString(),
          validUntil: expect.any(String),
        }),
        orderType: 'subscription_renew',
        period: 'year',
        planId: 'premium',
      }),
    );
    expect(result.order).toBe(renewalOrder);
  });

  it('creates an upgrade order with credit and price deltas', async () => {
    const currentPeriodEnd = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(async () => [
              {
                activatedAt: new Date(),
                createdAt: new Date(),
                id: 'current-order',
                metadata: { validUntil: currentPeriodEnd.toISOString() },
                orderType: 'subscription_new',
                period: 'month',
                planId: 'starter',
                status: 'activated',
                userId: 'user-1',
              },
            ]),
          })),
        })),
      })),
    };
    const upgradeOrder = {
      amountCents: 15_000,
      credits: 10_000_000,
      id: 'upgrade-order',
      orderType: 'subscription_upgrade',
      status: 'pending',
    };
    createOrder.mockResolvedValue(upgradeOrder);
    createPayment.mockResolvedValue({ channel: 'alipay', qrCodeUrl: '/pay/upgrade-order' });
    const service = new BillingOrderService(db as never, 'user-1');

    const result = await service.createUpgradeOrder({
      channel: 'alipay',
      targetPlanId: 'premium',
    });

    expect(createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCents: 15_000,
        credits: 10_000_000,
        metadata: expect.objectContaining({
          priceSource: 'temporary_test',
        }),
        orderType: 'subscription_upgrade',
        period: 'month',
        planId: 'premium',
      }),
    );
    expect(result.order).toBe(upgradeOrder);
  });

  it('cancels a pending top-up order', async () => {
    closePendingOrder.mockResolvedValue({ ...pendingOrder, status: 'closed' });
    const service = new BillingOrderService({} as never, 'user-1');

    await expect(service.cancelPendingOrder('order-1')).resolves.toMatchObject({
      id: 'order-1',
      status: 'closed',
    });
    expect(closePendingOrder).toHaveBeenCalledWith('order-1');
  });

  it('does not activate credits for a closed order callback', async () => {
    findOrderById.mockResolvedValue({ ...pendingOrder, status: 'closed' });
    recordPaymentCallback.mockResolvedValue({ id: 'payment-closed' });
    const service = new BillingOrderService({} as never, 'user-1');

    await expect(
      service.markPaidAndActivate({
        amountCents: 9900,
        channel: 'alipay',
        orderId: 'order-1',
        providerTransactionId: 'ali-tx-closed',
        rawCallback: { trade_status: 'TRADE_SUCCESS' },
        signatureVerified: true,
        succeeded: true,
      }),
    ).resolves.toEqual({ activated: false, orderId: 'order-1' });

    expect(recordPaymentCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        billingOrderId: 'order-1',
        providerTransactionId: 'ali-tx-closed',
        status: 'succeeded',
      }),
    );
    expect(grantTopUpCredits).not.toHaveBeenCalled();
    expect(updateOrderStatus).toHaveBeenCalledWith('order-1', {
      paymentTransactionId: 'payment-closed',
      status: 'exception',
    });
  });

  it('does not activate credits when a pending order closes during callback handling', async () => {
    findOrderById.mockResolvedValueOnce(pendingOrder).mockResolvedValueOnce({
      ...pendingOrder,
      status: 'closed',
    });
    recordPaymentCallback.mockResolvedValue(succeededTransaction);
    const service = new BillingOrderService({} as never, 'user-1');

    await expect(
      service.markPaidAndActivate({
        amountCents: 9900,
        channel: 'alipay',
        orderId: 'order-1',
        providerTransactionId: 'ali-tx-race',
        rawCallback: { trade_status: 'TRADE_SUCCESS' },
        signatureVerified: true,
        succeeded: true,
      }),
    ).resolves.toEqual({ activated: false, orderId: 'order-1' });

    expect(recordPaymentCallback).toHaveBeenCalledTimes(1);
    expect(grantTopUpCredits).not.toHaveBeenCalled();
    expect(updateOrderStatus).not.toHaveBeenCalled();
  });

  it('activates top-up credits once after a verified payment callback', async () => {
    findOrderById
      .mockResolvedValueOnce(pendingOrder)
      .mockResolvedValueOnce(pendingOrder)
      .mockResolvedValueOnce({ ...pendingOrder, status: 'activated' });
    recordPaymentCallback.mockResolvedValue(succeededTransaction);
    grantTopUpCredits.mockResolvedValue({ id: 'grant-1' });
    const service = new BillingOrderService({} as never, 'user-1');

    const first = await service.markPaidAndActivate({
      amountCents: 9900,
      channel: 'alipay',
      orderId: 'order-1',
      providerTransactionId: 'ali-tx-1',
      rawCallback: { trade_status: 'TRADE_SUCCESS' },
      signatureVerified: true,
      succeeded: true,
    });
    const second = await service.markPaidAndActivate({
      amountCents: 9900,
      channel: 'alipay',
      orderId: 'order-1',
      providerTransactionId: 'ali-tx-1',
      rawCallback: { trade_status: 'TRADE_SUCCESS' },
      signatureVerified: true,
      succeeded: true,
    });

    expect(first).toEqual({ activated: true, orderId: 'order-1' });
    expect(second).toEqual({ activated: false, orderId: 'order-1' });
    expect(grantTopUpCredits).toHaveBeenCalledTimes(1);
    expect(grantTopUpCredits).toHaveBeenCalledWith({
      amountCredits: 1_000_000,
      billingOrderId: 'order-1',
      operationId: 'top_up:order-1',
    });
  });

  it('does not activate credits for a verified but unsuccessful payment callback', async () => {
    findOrderById.mockResolvedValue(pendingOrder);
    recordPaymentCallback.mockResolvedValue({
      amountCents: 9900,
      billingOrderId: 'order-1',
      channel: 'alipay',
      id: 'payment-wait',
      signatureVerified: true,
      status: 'failed',
    });
    const service = new BillingOrderService({} as never, 'user-1');

    await expect(
      service.markPaidAndActivate({
        amountCents: 9900,
        channel: 'alipay',
        orderId: 'order-1',
        providerTransactionId: 'ali-tx-wait',
        rawCallback: { trade_status: 'WAIT_BUYER_PAY' },
        signatureVerified: true,
        succeeded: false,
      }),
    ).resolves.toEqual({ activated: false, orderId: 'order-1' });

    expect(recordPaymentCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        amountVerified: true,
        providerTransactionId: 'ali-tx-wait',
        status: 'failed',
      }),
    );
    expect(updateOrderStatus).toHaveBeenCalledWith('order-1', {
      paymentTransactionId: 'payment-wait',
      status: 'failed',
    });
    expect(grantTopUpCredits).not.toHaveBeenCalled();
  });

  it('rejects replaying a provider transaction onto another order', async () => {
    findOrderById.mockResolvedValue(pendingOrder);
    findTransactionByProviderTransactionId.mockResolvedValue({
      amountCents: 9900,
      billingOrderId: 'other-order',
      channel: 'alipay',
      id: 'payment-other',
      signatureVerified: true,
      status: 'succeeded',
    });
    const service = new BillingOrderService({} as never, 'user-1');

    await expect(
      service.markPaidAndActivate({
        amountCents: 9900,
        channel: 'alipay',
        orderId: 'order-1',
        providerTransactionId: 'ali-tx-replay',
        rawCallback: { trade_status: 'TRADE_SUCCESS' },
        signatureVerified: true,
        succeeded: true,
      }),
    ).rejects.toMatchObject({ code: 'PAYMENT_TRANSACTION_ORDER_MISMATCH' });

    expect(updateOrderStatus).toHaveBeenCalledWith('order-1', {
      paymentTransactionId: 'payment-other',
      status: 'exception',
    });
    expect(recordPaymentCallback).not.toHaveBeenCalled();
    expect(grantTopUpCredits).not.toHaveBeenCalled();
  });

  it('runs payment activation inside a database transaction', async () => {
    const tx = { tx: true };
    const db = {
      transaction: vi.fn(async (callback) => callback(tx)),
    };
    findOrderById.mockResolvedValue(pendingOrder);
    recordPaymentCallback.mockResolvedValue(succeededTransaction);
    grantTopUpCredits.mockResolvedValue({ id: 'grant-1' });
    const service = new BillingOrderService(db as never, 'user-1');

    await service.markPaidAndActivate({
      amountCents: 9900,
      channel: 'alipay',
      orderId: 'order-1',
      providerTransactionId: 'ali-tx-1',
      rawCallback: { trade_status: 'TRADE_SUCCESS' },
      signatureVerified: true,
      succeeded: true,
    });

    expect(db.transaction).toHaveBeenCalledTimes(1);
  });

  it('does not persist paid status when credit activation fails inside the transaction', async () => {
    const db = {
      transaction: vi.fn(async (callback) => callback({})),
    };
    findOrderById.mockResolvedValue(pendingOrder);
    recordPaymentCallback.mockResolvedValue({
      amountCents: 9900,
      billingOrderId: 'order-1',
      channel: 'alipay',
      id: 'payment-1',
      signatureVerified: true,
      status: 'succeeded',
    });
    grantTopUpCredits.mockRejectedValue(new Error('grant failed'));
    const service = new BillingOrderService(db as never, 'user-1');

    await expect(
      service.markPaidAndActivate({
        amountCents: 9900,
        channel: 'alipay',
        orderId: 'order-1',
        providerTransactionId: 'ali-tx-1',
        rawCallback: { trade_status: 'TRADE_SUCCESS' },
        signatureVerified: true,
        succeeded: true,
      }),
    ).rejects.toThrow('grant failed');

    expect(updateOrderStatus).toHaveBeenCalledWith('order-1', {
      paidAt: expect.any(Date),
      paymentTransactionId: 'payment-1',
      status: 'paid',
    });
    expect(updateOrderStatus).not.toHaveBeenCalledWith(
      'order-1',
      expect.objectContaining({ status: 'activated' }),
    );
  });

  it('activates a new subscription from the payment callback time', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T00:00:00.000Z'));
    const subscriptionOrder = {
      amountCents: 9900,
      credits: 5_000_000,
      id: 'subscription-order-1',
      metadata: { planName: 'Starter' },
      orderType: 'subscription_new',
      period: 'month',
      planId: 'starter',
      status: 'pending',
    };
    findOrderById.mockResolvedValueOnce(subscriptionOrder).mockResolvedValueOnce(subscriptionOrder);
    recordPaymentCallback.mockResolvedValue({
      amountCents: 9900,
      billingOrderId: 'subscription-order-1',
      channel: 'alipay',
      id: 'payment-1',
      signatureVerified: true,
      status: 'succeeded',
    });
    grantSubscriptionCredits.mockResolvedValue({ id: 'grant-subscription-1' });
    const service = new BillingOrderService({} as never, 'user-1');

    await expect(
      service.markPaidAndActivate({
        amountCents: 9900,
        channel: 'alipay',
        orderId: 'subscription-order-1',
        providerTransactionId: 'ali-subscription-tx-1',
        rawCallback: { trade_status: 'TRADE_SUCCESS' },
        signatureVerified: true,
        succeeded: true,
      }),
    ).resolves.toEqual({ activated: true, orderId: 'subscription-order-1' });

    expect(grantSubscriptionCredits).toHaveBeenCalledWith({
      amountCredits: 5_000_000,
      billingOrderId: 'subscription-order-1',
      expiresAt: new Date('2026-07-01T00:00:00.000Z'),
      metadata: {
        cycleIndex: 0,
        cycleTotal: 1,
        orderType: 'subscription_new',
        period: 'month',
        planId: 'starter',
      },
      operationId: 'subscription:subscription-order-1',
      startsAt: new Date('2026-06-01T00:00:00.000Z'),
    });
  });

  it('activates yearly subscriptions as monthly grants instead of one full-year credit grant', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T00:00:00.000Z'));
    const subscriptionOrder = {
      amountCents: 99_000,
      credits: 5_000_000,
      id: 'subscription-year-order-1',
      metadata: { planName: 'Starter' },
      orderType: 'subscription_new',
      period: 'year',
      planId: 'starter',
      status: 'pending',
    };
    findOrderById.mockResolvedValueOnce(subscriptionOrder).mockResolvedValueOnce(subscriptionOrder);
    recordPaymentCallback.mockResolvedValue({
      amountCents: 99_000,
      billingOrderId: 'subscription-year-order-1',
      channel: 'alipay',
      id: 'payment-year-1',
      signatureVerified: true,
      status: 'succeeded',
    });
    grantSubscriptionCredits.mockResolvedValue({ id: 'grant-subscription-year-1' });
    const service = new BillingOrderService({} as never, 'user-1');

    await expect(
      service.markPaidAndActivate({
        amountCents: 99_000,
        channel: 'alipay',
        orderId: 'subscription-year-order-1',
        providerTransactionId: 'ali-subscription-year-tx-1',
        rawCallback: { trade_status: 'TRADE_SUCCESS' },
        signatureVerified: true,
        succeeded: true,
      }),
    ).resolves.toEqual({ activated: true, orderId: 'subscription-year-order-1' });

    expect(grantSubscriptionCredits).toHaveBeenCalledTimes(12);
    expect(grantSubscriptionCredits).toHaveBeenNthCalledWith(1, {
      amountCredits: 5_000_000,
      billingOrderId: 'subscription-year-order-1',
      expiresAt: new Date('2026-07-01T00:00:00.000Z'),
      metadata: {
        cycleIndex: 0,
        cycleTotal: 12,
        orderType: 'subscription_new',
        period: 'year',
        planId: 'starter',
      },
      operationId: 'subscription:subscription-year-order-1:cycle:1',
      startsAt: new Date('2026-06-01T00:00:00.000Z'),
    });
    expect(grantSubscriptionCredits).toHaveBeenNthCalledWith(
      12,
      expect.objectContaining({
        amountCredits: 5_000_000,
        expiresAt: new Date('2027-06-01T00:00:00.000Z'),
        operationId: 'subscription:subscription-year-order-1:cycle:12',
        startsAt: new Date('2027-04-27T00:00:00.000Z'),
      }),
    );
    expect(grantSubscriptionCredits).not.toHaveBeenCalledWith(
      expect.objectContaining({ amountCredits: 60_000_000 }),
    );
  });

  it('activates a renewal subscription only when the renewed period starts', async () => {
    const subscriptionOrder = {
      amountCents: 24_900,
      credits: 15_000_000,
      id: 'renew-order-1',
      metadata: {
        currentPeriodEnd: '2026-07-01T00:00:00.000Z',
        validFrom: '2026-07-01T00:00:00.000Z',
        validUntil: '2026-07-31T00:00:00.000Z',
      },
      orderType: 'subscription_renew',
      period: 'month',
      planId: 'premium',
      status: 'pending',
    };
    findOrderById.mockResolvedValueOnce(subscriptionOrder).mockResolvedValueOnce(subscriptionOrder);
    recordPaymentCallback.mockResolvedValue({
      amountCents: 24_900,
      billingOrderId: 'renew-order-1',
      channel: 'alipay',
      id: 'payment-1',
      signatureVerified: true,
      status: 'succeeded',
    });
    grantSubscriptionCredits.mockResolvedValue({ id: 'grant-subscription-renew' });
    const service = new BillingOrderService({} as never, 'user-1');

    await expect(
      service.markPaidAndActivate({
        amountCents: 24_900,
        channel: 'alipay',
        orderId: 'renew-order-1',
        providerTransactionId: 'ali-renew-tx-1',
        rawCallback: { trade_status: 'TRADE_SUCCESS' },
        signatureVerified: true,
        succeeded: true,
      }),
    ).resolves.toEqual({ activated: true, orderId: 'renew-order-1' });

    expect(grantSubscriptionCredits).toHaveBeenCalledWith(
      expect.objectContaining({
        billingOrderId: 'renew-order-1',
        expiresAt: new Date('2026-07-31T00:00:00.000Z'),
        operationId: 'subscription:renew-order-1',
        startsAt: new Date('2026-07-01T00:00:00.000Z'),
      }),
    );
  });

  it('activates an upgrade subscription until the current period end', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-10T00:00:00.000Z'));
    const subscriptionOrder = {
      amountCents: 15_000,
      credits: 10_000_000,
      id: 'upgrade-order-1',
      metadata: {
        currentPeriodEnd: '2026-07-01T00:00:00.000Z',
        currentPlanId: 'starter',
      },
      orderType: 'subscription_upgrade',
      period: 'month',
      planId: 'premium',
      status: 'pending',
    };
    findOrderById.mockResolvedValueOnce(subscriptionOrder).mockResolvedValueOnce(subscriptionOrder);
    recordPaymentCallback.mockResolvedValue({
      amountCents: 15_000,
      billingOrderId: 'upgrade-order-1',
      channel: 'alipay',
      id: 'payment-1',
      signatureVerified: true,
      status: 'succeeded',
    });
    grantSubscriptionCredits.mockResolvedValue({ id: 'grant-subscription-upgrade' });
    const service = new BillingOrderService({} as never, 'user-1');

    await expect(
      service.markPaidAndActivate({
        amountCents: 15_000,
        channel: 'alipay',
        orderId: 'upgrade-order-1',
        providerTransactionId: 'ali-upgrade-tx-1',
        rawCallback: { trade_status: 'TRADE_SUCCESS' },
        signatureVerified: true,
        succeeded: true,
      }),
    ).resolves.toEqual({ activated: true, orderId: 'upgrade-order-1' });

    expect(grantSubscriptionCredits).toHaveBeenCalledWith(
      expect.objectContaining({
        billingOrderId: 'upgrade-order-1',
        expiresAt: new Date('2026-07-01T00:00:00.000Z'),
        operationId: 'subscription:upgrade-order-1',
        startsAt: new Date('2026-06-10T00:00:00.000Z'),
      }),
    );
  });
});
