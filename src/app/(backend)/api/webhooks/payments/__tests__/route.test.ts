// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

const { markPaidAndActivate } = vi.hoisted(() => ({
  markPaidAndActivate: vi.fn().mockResolvedValue({ activated: true, orderId: 'order-1' }),
}));

vi.mock('@/business/server/billing/orders', () => ({
  BillingOrderService: {
    forSystem: vi.fn().mockImplementation(() => ({ markPaidAndActivate })),
  },
}));

vi.mock('@/business/server/billing/payments', () => ({
  getPaymentAdapter: () => ({
    parseCallback: vi.fn().mockResolvedValue({
      amountCents: 9900,
      channel: 'alipay',
      orderId: 'order-1',
      providerTransactionId: 'ali-tx-1',
      rawCallback: { trade_status: 'TRADE_SUCCESS' },
      signatureVerified: true,
      succeeded: true,
    }),
  }),
}));

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn().mockResolvedValue({}),
}));

import { POST as alipayPost } from '../alipay/route';

describe('payment webhook routes', () => {
  it('activates an order from alipay callback', async () => {
    const response = await alipayPost(new Request('http://test.local', { method: 'POST' }));

    await expect(response.text()).resolves.toBe('success');
    expect(markPaidAndActivate).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCents: 9900,
        orderId: 'order-1',
        providerTransactionId: 'ali-tx-1',
        succeeded: true,
      }),
    );
  });
});
