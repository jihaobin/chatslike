// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

const createPaymentParams = {
  amountCents: 600,
  channel: 'alipay',
  description: '5M',
  orderId: 'order-1',
} as const;

describe('payment adapters', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('allows mock Alipay checkout without real signing credentials outside production', async () => {
    vi.stubEnv('BILLING_ALLOW_MOCK_PAYMENTS', '1');
    vi.stubEnv('NODE_ENV', 'development');
    vi.resetModules();

    const { AlipayAdapter } = await import('../payments/alipay');

    await expect(new AlipayAdapter().createPayment(createPaymentParams)).resolves.toMatchObject({
      channel: 'alipay',
      qrCodeUrl: '/api/payments/mock/alipay/order-1',
    });
  });

  it('allows mock WeChat checkout without real signing credentials outside production', async () => {
    vi.stubEnv('BILLING_ALLOW_MOCK_PAYMENTS', '1');
    vi.stubEnv('NODE_ENV', 'development');
    vi.resetModules();

    const { WechatPayAdapter } = await import('../payments/wechat');

    await expect(
      new WechatPayAdapter().createPayment({
        ...createPaymentParams,
        channel: 'wechat',
      }),
    ).resolves.toMatchObject({
      channel: 'wechat',
      qrCodeUrl: '/api/payments/mock/wechat/order-1',
    });
  });
});
