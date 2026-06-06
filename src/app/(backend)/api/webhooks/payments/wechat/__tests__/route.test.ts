// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

import { POST } from '../route';

const { markPaidAndActivate, parseCallbackPayload } = vi.hoisted(() => ({
  markPaidAndActivate: vi.fn().mockResolvedValue({ activated: true, orderId: 'order-1' }),
  parseCallbackPayload: vi.fn().mockResolvedValue({
    amountCents: 600,
    channel: 'wechat',
    orderId: 'order-1',
    providerTransactionId: 'wx-tx-1',
    rawCallback: { trade_state: 'SUCCESS' },
    signatureVerified: true,
    succeeded: true,
  }),
}));

vi.mock('@/business/server/billing/orders', () => ({
  BillingOrderService: {
    forSystem: vi.fn().mockImplementation(() => ({ markPaidAndActivate })),
  },
}));

vi.mock('@/business/server/billing/payments', () => ({
  getPaymentAdapter: () => ({ parseCallbackPayload }),
}));

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn().mockResolvedValue({}),
}));

describe('WeChat payment webhook route', () => {
  afterEach(() => {
    markPaidAndActivate.mockClear();
    parseCallbackPayload.mockClear();
    parseCallbackPayload.mockResolvedValue({
      amountCents: 600,
      channel: 'wechat',
      orderId: 'order-1',
      providerTransactionId: 'wx-tx-1',
      rawCallback: { trade_state: 'SUCCESS' },
      signatureVerified: true,
      succeeded: true,
    });
  });

  it('passes the original request body to the WeChat adapter', async () => {
    const rawBody = '{"id":"notify-1","resource":{"ciphertext":"abc"}}';
    const request = new Request('https://example.com/api/webhooks/payments/wechat', {
      body: rawBody,
      headers: { 'Wechatpay-Nonce': 'nonce' },
      method: 'POST',
    });

    const response = await POST(request);

    expect(parseCallbackPayload).toHaveBeenCalledWith({ headers: request.headers, rawBody });
    expect(markPaidAndActivate).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'order-1', providerTransactionId: 'wx-tx-1' }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ code: 'SUCCESS', message: '成功' });
  });

  it('returns a retry-worthy failure when WeChat callback parsing fails', async () => {
    parseCallbackPayload.mockRejectedValue(new Error('WeChat Pay signature verification failed'));

    const response = await POST(
      new Request('https://example.com/api/webhooks/payments/wechat', {
        body: '{"id":"notify-1"}',
        method: 'POST',
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ code: 'FAIL', message: '失败' });
    expect(markPaidAndActivate).not.toHaveBeenCalled();
  });
});
