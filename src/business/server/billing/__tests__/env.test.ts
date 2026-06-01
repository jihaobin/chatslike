// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { getAppConfig } from '@/envs/app';

import { getBillingEnv } from '../env';

describe('billing env', () => {
  it('uses safe defaults when platform billing is disabled', () => {
    expect(getBillingEnv({ NEXT_PUBLIC_ENABLE_PLATFORM_BILLING: '0' })).toMatchObject({
      enabled: false,
      limits: {
        freeDailyCredits: 1_000_000,
        paidDailyCredits: 10_000_000,
      },
      trial: {
        credits: 500_000,
        validDays: 30,
      },
    });
  });

  it('reads platform billing, payment credentials and limit overrides', () => {
    expect(
      getBillingEnv({
        ALIPAY_APP_ID: 'ali-app',
        ALIPAY_NOTIFY_URL: 'https://example.com/api/webhooks/payments/alipay',
        ALIPAY_PRIVATE_KEY: 'ali-private',
        ALIPAY_PUBLIC_KEY: 'ali-public',
        BILLING_FREE_DAILY_LIMIT: '2000000',
        BILLING_PAID_DAILY_LIMIT: '20000000',
        BILLING_TRIAL_CREDITS: '600000',
        BILLING_TRIAL_VALID_DAYS: '45',
        NEXT_PUBLIC_ENABLE_PLATFORM_BILLING: '1',
        WECHAT_PAY_API_V3_KEY: 'wechat-v3',
        WECHAT_PAY_APP_ID: 'wechat-app',
        WECHAT_PAY_MCH_ID: 'wechat-mch',
        WECHAT_PAY_NOTIFY_URL: 'https://example.com/api/webhooks/payments/wechat',
        WECHAT_PAY_PRIVATE_KEY: 'wechat-private',
        WECHAT_PAY_SERIAL_NO: 'wechat-serial',
      }),
    ).toMatchObject({
      alipay: {
        appId: 'ali-app',
        notifyUrl: 'https://example.com/api/webhooks/payments/alipay',
        privateKey: 'ali-private',
        publicKey: 'ali-public',
      },
      enabled: true,
      limits: {
        freeDailyCredits: 2_000_000,
        paidDailyCredits: 20_000_000,
      },
      trial: {
        credits: 600_000,
        validDays: 45,
      },
      wechatPay: {
        apiV3Key: 'wechat-v3',
        appId: 'wechat-app',
        mchId: 'wechat-mch',
        notifyUrl: 'https://example.com/api/webhooks/payments/wechat',
        privateKey: 'wechat-private',
        serialNo: 'wechat-serial',
      },
    });
  });

  it('registers billing and commercial variables in the server app env config', () => {
    const config = getAppConfig();

    expect(config.NEXT_PUBLIC_ENABLE_PLATFORM_BILLING).toBe(false);
    expect(config.ENABLE_COMMERCIAL).toBe(false);
    expect(config.ENABLE_NATIVE_BILLING).toBe(false);
    expect(config.ENABLE_PLATFORM_HOSTED_MODELS).toBe(false);
    expect(config.ENABLE_LOBEHUB_CLOUD_INTEGRATION).toBe(false);
    expect(config.BILLING_TRIAL_CREDITS).toBeUndefined();
    expect(config.ALIPAY_PRIVATE_KEY).toBeUndefined();
    expect(config.WECHAT_PAY_API_V3_KEY).toBeUndefined();
  });
});
