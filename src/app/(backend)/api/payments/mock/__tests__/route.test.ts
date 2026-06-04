// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '../[channel]/[orderId]/route';

const { getServerDB, markPaidAndActivate } = vi.hoisted(() => ({
  getServerDB: vi.fn(),
  markPaidAndActivate: vi.fn().mockResolvedValue({ activated: true, orderId: 'order-1' }),
}));

vi.mock('@/business/server/billing/orders', () => ({
  BillingOrderService: {
    forSystem: vi.fn().mockImplementation(() => ({ markPaidAndActivate })),
  },
}));

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB,
}));

const createDbWithOrder = (order: Record<string, unknown> | undefined) => ({
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn().mockResolvedValue(order ? [order] : []),
      })),
    })),
  })),
});

describe('mock payment route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv('BILLING_ALLOW_MOCK_PAYMENTS', '1');
    vi.stubEnv('NODE_ENV', 'development');
  });

  it('activates the billing order when a tester opens the mock payment link', async () => {
    getServerDB.mockResolvedValue(
      createDbWithOrder({
        amountCents: 600,
        id: 'order-1',
        paymentChannel: 'alipay',
      }),
    );

    const response = await GET(new Request('http://test.local/api/payments/mock/alipay/order-1'), {
      params: Promise.resolve({ channel: 'alipay', orderId: 'order-1' }),
    });

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain('Mock payment completed');
    expect(markPaidAndActivate).toHaveBeenCalledWith({
      amountCents: 600,
      channel: 'alipay',
      orderId: 'order-1',
      providerTransactionId: 'mock:alipay:order-1',
      rawCallback: {
        mock: true,
        orderId: 'order-1',
        source: 'BILLING_ALLOW_MOCK_PAYMENTS',
      },
      signatureVerified: true,
      succeeded: true,
    });
  });

  it('does not activate mock payments when the guard is disabled', async () => {
    vi.stubEnv('BILLING_ALLOW_MOCK_PAYMENTS', '0');
    getServerDB.mockResolvedValue(
      createDbWithOrder({
        amountCents: 600,
        id: 'order-1',
        paymentChannel: 'alipay',
      }),
    );

    const response = await GET(new Request('http://test.local/api/payments/mock/alipay/order-1'), {
      params: Promise.resolve({ channel: 'alipay', orderId: 'order-1' }),
    });

    expect(response.status).toBe(403);
    expect(markPaidAndActivate).not.toHaveBeenCalled();
  });
});
