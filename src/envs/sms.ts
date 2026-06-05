import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv {
      ALIBABA_CLOUD_ACCESS_KEY_ID?: string;
      ALIBABA_CLOUD_ACCESS_KEY_SECRET?: string;
      ALIBABA_CLOUD_ROLE_ARN?: string;
      ALIBABA_CLOUD_ROLE_SESSION_EXPIRATION?: string;
      ALIBABA_CLOUD_ROLE_SESSION_NAME?: string;
      ALIBABA_CLOUD_SECURITY_TOKEN?: string;
      ALIBABA_CLOUD_STS_ENDPOINT?: string;
      ALIBABA_CLOUD_STS_POLICY?: string;
      ALIYUN_SMS_ENDPOINT?: string;
      ALIYUN_SMS_REGION_ID?: string;
      ALIYUN_SMS_SIGN_NAME?: string;
      ALIYUN_SMS_TEMPLATE_CODE?: string;
    }
  }
}

export const getSmsConfig = () => {
  return createEnv({
    runtimeEnv: {
      ALIBABA_CLOUD_ACCESS_KEY_ID: process.env.ALIBABA_CLOUD_ACCESS_KEY_ID,
      ALIBABA_CLOUD_ACCESS_KEY_SECRET: process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET,
      ALIBABA_CLOUD_ROLE_ARN: process.env.ALIBABA_CLOUD_ROLE_ARN,
      ALIBABA_CLOUD_ROLE_SESSION_EXPIRATION: process.env.ALIBABA_CLOUD_ROLE_SESSION_EXPIRATION,
      ALIBABA_CLOUD_ROLE_SESSION_NAME: process.env.ALIBABA_CLOUD_ROLE_SESSION_NAME,
      ALIBABA_CLOUD_SECURITY_TOKEN: process.env.ALIBABA_CLOUD_SECURITY_TOKEN,
      ALIBABA_CLOUD_STS_ENDPOINT: process.env.ALIBABA_CLOUD_STS_ENDPOINT,
      ALIBABA_CLOUD_STS_POLICY: process.env.ALIBABA_CLOUD_STS_POLICY,
      ALIYUN_SMS_ENDPOINT: process.env.ALIYUN_SMS_ENDPOINT,
      ALIYUN_SMS_REGION_ID: process.env.ALIYUN_SMS_REGION_ID || 'cn-hangzhou',
      ALIYUN_SMS_SIGN_NAME: process.env.ALIYUN_SMS_SIGN_NAME,
      ALIYUN_SMS_TEMPLATE_CODE: process.env.ALIYUN_SMS_TEMPLATE_CODE,
    },
    server: {
      ALIBABA_CLOUD_ACCESS_KEY_ID: z.string().optional(),
      ALIBABA_CLOUD_ACCESS_KEY_SECRET: z.string().optional(),
      ALIBABA_CLOUD_ROLE_ARN: z.string().optional(),
      ALIBABA_CLOUD_ROLE_SESSION_EXPIRATION: z.coerce
        .number()
        .int()
        .min(900)
        .max(43_200)
        .optional(),
      ALIBABA_CLOUD_ROLE_SESSION_NAME: z.string().optional(),
      ALIBABA_CLOUD_SECURITY_TOKEN: z.string().optional(),
      ALIBABA_CLOUD_STS_ENDPOINT: z.string().optional(),
      ALIBABA_CLOUD_STS_POLICY: z.string().optional(),
      ALIYUN_SMS_ENDPOINT: z.string().optional(),
      ALIYUN_SMS_REGION_ID: z.string().default('cn-hangzhou'),
      ALIYUN_SMS_SIGN_NAME: z.string().optional(),
      ALIYUN_SMS_TEMPLATE_CODE: z.string().optional(),
    },
  });
};

export const smsEnv = getSmsConfig();
