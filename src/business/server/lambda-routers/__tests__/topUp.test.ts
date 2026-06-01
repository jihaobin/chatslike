// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { topUpRouter } from '../topUp';

const { cancelPendingOrder, createTopUpOrder, getOrder, listOrders, mockDb } = vi.hoisted(() => ({
  cancelPendingOrder: vi.fn(),
  createTopUpOrder: vi.fn(),
  getOrder: vi.fn(),
  listOrders: vi.fn(),
  mockDb: {},
}));

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn(async () => mockDb),
}));

vi.mock('@/business/server/billing/orders', () => ({
  BillingOrderService: vi.fn().mockImplementation(() => ({
    cancelPendingOrder,
    createTopUpOrder,
    getOrder,
    listOrders,
  })),
}));

describe('topUpRouter', () => {
  beforeEach(() => {
    cancelPendingOrder.mockReset();
    createTopUpOrder.mockReset();
    getOrder.mockReset();
    listOrders.mockReset();
  });

  it('cancels a pending top-up order for the authed user', async () => {
    cancelPendingOrder.mockResolvedValue({ id: 'order-1', status: 'closed' });
    const caller = topUpRouter.createCaller({ userId: 'user-1' });

    await expect(caller.cancelOrder({ orderId: 'order-1' })).resolves.toMatchObject({
      id: 'order-1',
      status: 'closed',
    });
    expect(cancelPendingOrder).toHaveBeenCalledWith('order-1');
  });

  it('creates a top-up order for the authed user', async () => {
    createTopUpOrder.mockResolvedValue({
      order: {
        amountCents: 600,
        credits: 5_000_000,
        id: 'order-1',
        status: 'pending',
      },
      payment: {
        channel: 'alipay',
        qrCodeUrl: '/pay/order-1',
      },
    });
    const caller = topUpRouter.createCaller({ userId: 'user-1' });

    await expect(
      caller.createOrder({ channel: 'alipay', productId: 'topup_5m' }),
    ).resolves.toMatchObject({
      order: {
        amountCents: 600,
        credits: 5_000_000,
        id: 'order-1',
      },
      payment: {
        qrCodeUrl: '/pay/order-1',
      },
    });
    expect(createTopUpOrder).toHaveBeenCalledWith({
      channel: 'alipay',
      productId: 'topup_5m',
    });
  });

  it('returns an order by id', async () => {
    getOrder.mockResolvedValue({ id: 'order-1', status: 'activated' });
    const caller = topUpRouter.createCaller({ userId: 'user-1' });

    await expect(caller.getOrder({ orderId: 'order-1' })).resolves.toMatchObject({
      id: 'order-1',
      status: 'activated',
    });
    expect(getOrder).toHaveBeenCalledWith('order-1');
  });

  it('lists top-up orders for the authed user', async () => {
    listOrders.mockResolvedValue({
      items: [{ amountCents: 9900, id: 'order-1', status: 'pending' }],
      nextCursor: undefined,
    });
    const caller = topUpRouter.createCaller({ userId: 'user-1' });

    await expect(caller.listOrders({ pageSize: 20 })).resolves.toMatchObject({
      items: [{ id: 'order-1', status: 'pending' }],
    });
    expect(listOrders).toHaveBeenCalledWith({ cursor: undefined, pageSize: 20 });
  });
});
