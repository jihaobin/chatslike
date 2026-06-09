// @vitest-environment node
import { createCipheriv, createSign, generateKeyPairSync, randomBytes } from 'node:crypto';

import { afterEach, describe, expect, it, vi } from 'vitest';

const createPaymentParams = {
  amountCents: 600,
  channel: 'alipay',
  description: '5M',
  orderId: 'order-1',
} as const;

const { privateKey: privateKeyPem, publicKey: publicKeyPem } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { format: 'pem', type: 'pkcs8' },
  publicKeyEncoding: { format: 'pem', type: 'spki' },
});

const stubWechatPayEnv = () => {
  vi.stubEnv('WECHAT_PAY_API_V3_KEY', '12345678901234567890123456789012');
  vi.stubEnv('WECHAT_PAY_APP_ID', 'wx-app');
  vi.stubEnv('WECHAT_PAY_MCH_ID', 'mch-1');
  vi.stubEnv('WECHAT_PAY_NOTIFY_URL', 'https://example.com/api/webhooks/payments/wechat');
  vi.stubEnv('WECHAT_PAY_PRIVATE_KEY', privateKeyPem.replaceAll('\n', '\\n'));
  vi.stubEnv('WECHAT_PAY_PUBLIC_KEY', publicKeyPem.replaceAll('\n', '\\n'));
  vi.stubEnv('WECHAT_PAY_PUBLIC_KEY_ID', 'PUB_KEY_ID_011423');
  vi.stubEnv('WECHAT_PAY_SERIAL_NO', 'serial-1');
};

const buildSignedWechatNotifyRequest = (params: { rawResource: Record<string, unknown> }) => {
  const associatedData = 'transaction';
  const nonce = randomBytes(12).toString('hex').slice(0, 12);
  const cipher = createCipheriv(
    'aes-256-gcm',
    Buffer.from('12345678901234567890123456789012'),
    nonce,
  );
  cipher.setAAD(Buffer.from(associatedData));
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(params.rawResource), 'utf8'),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  const rawBody = JSON.stringify({
    id: 'notify-1',
    resource: {
      associated_data: associatedData,
      ciphertext: encrypted.toString('base64'),
      nonce,
    },
  });
  const timestamp = `${Math.floor(Date.now() / 1000)}`;
  const requestNonce = 'notify-nonce';
  const signer = createSign('RSA-SHA256');
  signer.update(`${timestamp}\n${requestNonce}\n${rawBody}\n`);
  signer.end();

  return new Request('https://example.com/api/webhooks/payments/wechat', {
    body: rawBody,
    headers: {
      'Wechatpay-Nonce': requestNonce,
      'Wechatpay-Serial': 'PUB_KEY_ID_011423',
      'Wechatpay-Signature': signer.sign(privateKeyPem, 'base64'),
      'Wechatpay-Timestamp': timestamp,
    },
    method: 'POST',
  });
};

describe('payment adapters', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
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

  it('creates a WeChat Native transaction with signed API v3 request', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ code_url: 'weixin://wxpay/bizpayurl/up?pr=test' }), {
          status: 200,
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    stubWechatPayEnv();
    vi.resetModules();

    const { WechatPayAdapter } = await import('../payments/wechat');

    await expect(
      new WechatPayAdapter().createPayment({
        amountCents: 600,
        channel: 'wechat',
        description: '5M',
        orderId: 'order-1',
      }),
    ).resolves.toMatchObject({
      channel: 'wechat',
      qrCodeUrl: 'weixin://wxpay/bizpayurl/up?pr=test',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.mch.weixin.qq.com/v3/pay/transactions/native',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Accept': 'application/json',
          'Authorization': expect.stringContaining('WECHATPAY2-SHA256-RSA2048'),
          'Content-Type': 'application/json',
        }),
        method: 'POST',
      }),
    );
  });

  it('returns WeChat query trade states for non-success payments', async () => {
    const tradeStates = ['USERPAYING', 'NOTPAY', 'CLOSED', 'REVOKED', 'PAYERROR'] as const;
    const fetchMock = vi.fn(async () => {
      const tradeState = tradeStates[fetchMock.mock.calls.length - 1];

      return new Response(
        JSON.stringify({
          appid: 'wx-app',
          mchid: 'mch-1',
          out_trade_no: `order-${tradeState}`,
          trade_state: tradeState,
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    stubWechatPayEnv();
    vi.resetModules();

    const { WechatPayAdapter } = await import('../payments/wechat');
    const adapter = new WechatPayAdapter();

    for (const tradeState of tradeStates) {
      await expect(
        adapter.queryPayment({ amountCents: 600, orderId: `order-${tradeState}` }),
      ).resolves.toMatchObject({
        channel: 'wechat',
        orderId: `order-${tradeState}`,
        succeeded: false,
        tradeState,
      });
    }
  });

  it('parses a verified WeChat payment notification into callback result', async () => {
    const request = buildSignedWechatNotifyRequest({
      rawResource: {
        amount: { currency: 'CNY', total: 600 },
        appid: 'wx-app',
        mchid: 'mch-1',
        out_trade_no: 'order-1',
        trade_state: 'SUCCESS',
        transaction_id: 'wx-tx-1',
      },
    });
    stubWechatPayEnv();
    vi.resetModules();

    const { WechatPayAdapter } = await import('../payments/wechat');

    await expect(new WechatPayAdapter().parseCallback(request)).resolves.toMatchObject({
      amountCents: 600,
      channel: 'wechat',
      orderId: 'order-1',
      providerTransactionId: 'wx-tx-1',
      signatureVerified: true,
      succeeded: true,
    });
  });

  it('rejects WeChat notifications with invalid signatures', async () => {
    stubWechatPayEnv();
    vi.resetModules();

    const { WechatPayAdapter } = await import('../payments/wechat');
    const request = new Request('https://example.com/api/webhooks/payments/wechat', {
      body: JSON.stringify({ id: 'notify-1', resource: {} }),
      headers: {
        'Wechatpay-Nonce': 'nonce',
        'Wechatpay-Serial': 'PUB_KEY_ID_011423',
        'Wechatpay-Signature': 'invalid',
        'Wechatpay-Timestamp': `${Math.floor(Date.now() / 1000)}`,
      },
      method: 'POST',
    });

    await expect(new WechatPayAdapter().parseCallback(request)).rejects.toThrow(
      'WeChat Pay signature verification failed',
    );
  });

  it('treats a 204 WeChat close transaction response as success', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    stubWechatPayEnv();
    vi.resetModules();

    const { WechatPayAdapter } = await import('../payments/wechat');

    await expect(
      new WechatPayAdapter().closePayment({ orderId: 'order-1' }),
    ).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.mch.weixin.qq.com/v3/pay/transactions/out-trade-no/order-1/close',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
