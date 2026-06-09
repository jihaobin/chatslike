export interface BillingRuntimeEnv extends Record<string, number | string | undefined> {
  ALIPAY_APP_ID?: string;
  ALIPAY_NOTIFY_URL?: string;
  ALIPAY_PRIVATE_KEY?: string;
  ALIPAY_PUBLIC_KEY?: string;
  BILLING_ALLOW_MOCK_PAYMENTS?: string;
  BILLING_FREE_DAILY_LIMIT?: number | string;
  BILLING_PAID_DAILY_LIMIT?: number | string;
  BILLING_TRIAL_CREDITS?: number | string;
  BILLING_TRIAL_VALID_DAYS?: number | string;
  NEXT_PUBLIC_ENABLE_PLATFORM_BILLING?: string;
  NODE_ENV?: string;
  WECHAT_PAY_API_V3_KEY?: string;
  WECHAT_PAY_APP_ID?: string;
  WECHAT_PAY_MCH_ID?: string;
  WECHAT_PAY_NOTIFY_URL?: string;
  WECHAT_PAY_PRIVATE_KEY?: string;
  WECHAT_PAY_PUBLIC_KEY?: string;
  WECHAT_PAY_PUBLIC_KEY_ID?: string;
  WECHAT_PAY_SERIAL_NO?: string;
}

const DEFAULT_TRIAL_CREDITS = 500_000;
const DEFAULT_TRIAL_VALID_DAYS = 30;
const DEFAULT_FREE_DAILY_LIMIT = 1_000_000;
const DEFAULT_PAID_DAILY_LIMIT = 10_000_000;

const parsePositiveInteger = (value: number | string | undefined, fallback: number) => {
  if (value === undefined || value === '') return fallback;

  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizePem = (value: string | undefined) => value?.replaceAll('\\n', '\n');

export const getBillingEnv = (env: BillingRuntimeEnv = process.env) => ({
  alipay: {
    appId: env.ALIPAY_APP_ID,
    notifyUrl: env.ALIPAY_NOTIFY_URL,
    privateKey: env.ALIPAY_PRIVATE_KEY,
    publicKey: env.ALIPAY_PUBLIC_KEY,
  },
  allowMockPayments: env.NODE_ENV !== 'production' && env.BILLING_ALLOW_MOCK_PAYMENTS === '1',
  enabled: env.NEXT_PUBLIC_ENABLE_PLATFORM_BILLING === '1',
  limits: {
    freeDailyCredits: parsePositiveInteger(env.BILLING_FREE_DAILY_LIMIT, DEFAULT_FREE_DAILY_LIMIT),
    paidDailyCredits: parsePositiveInteger(env.BILLING_PAID_DAILY_LIMIT, DEFAULT_PAID_DAILY_LIMIT),
  },
  trial: {
    credits: parsePositiveInteger(env.BILLING_TRIAL_CREDITS, DEFAULT_TRIAL_CREDITS),
    validDays: parsePositiveInteger(env.BILLING_TRIAL_VALID_DAYS, DEFAULT_TRIAL_VALID_DAYS),
  },
  wechatPay: {
    appId: env.WECHAT_PAY_APP_ID,
    apiV3Key: env.WECHAT_PAY_API_V3_KEY,
    mchId: env.WECHAT_PAY_MCH_ID,
    notifyUrl: env.WECHAT_PAY_NOTIFY_URL,
    privateKey: normalizePem(env.WECHAT_PAY_PRIVATE_KEY),
    publicKey: normalizePem(env.WECHAT_PAY_PUBLIC_KEY),
    publicKeyId: env.WECHAT_PAY_PUBLIC_KEY_ID,
    serialNo: env.WECHAT_PAY_SERIAL_NO,
  },
});

export const billingEnv = getBillingEnv();
