import { TRPCError } from '@trpc/server';

import { smsEnv } from '@/envs/sms';

import { AliyunSmsProvider } from './impls/aliyun';
import type { AliyunSmsProviderConfig, SmsProvider } from './types';

const createMissingConfigError = () =>
  new TRPCError({ code: 'PRECONDITION_FAILED', message: 'SMS_CONFIG_MISSING' });

export const createAliyunSmsProvider = (): SmsProvider => {
  const {
    ALIBABA_CLOUD_ACCESS_KEY_ID,
    ALIBABA_CLOUD_ACCESS_KEY_SECRET,
    ALIBABA_CLOUD_ROLE_ARN,
    ALIBABA_CLOUD_ROLE_SESSION_EXPIRATION,
    ALIBABA_CLOUD_ROLE_SESSION_NAME,
    ALIBABA_CLOUD_SECURITY_TOKEN,
    ALIBABA_CLOUD_STS_ENDPOINT,
    ALIBABA_CLOUD_STS_POLICY,
    ALIYUN_SMS_ENDPOINT,
    ALIYUN_SMS_REGION_ID,
    ALIYUN_SMS_SIGN_NAME,
    ALIYUN_SMS_TEMPLATE_CODE,
  } = smsEnv;

  if (
    !ALIBABA_CLOUD_ACCESS_KEY_ID ||
    !ALIBABA_CLOUD_ACCESS_KEY_SECRET ||
    !ALIYUN_SMS_SIGN_NAME ||
    !ALIYUN_SMS_TEMPLATE_CODE
  ) {
    throw createMissingConfigError();
  }

  const baseConfig = {
    accessKeyId: ALIBABA_CLOUD_ACCESS_KEY_ID,
    accessKeySecret: ALIBABA_CLOUD_ACCESS_KEY_SECRET,
    endpoint: ALIYUN_SMS_ENDPOINT,
    regionId: ALIYUN_SMS_REGION_ID,
    signName: ALIYUN_SMS_SIGN_NAME,
    templateCode: ALIYUN_SMS_TEMPLATE_CODE,
  };

  let providerConfig: AliyunSmsProviderConfig;

  if (ALIBABA_CLOUD_ROLE_ARN) {
    if (!ALIBABA_CLOUD_ROLE_SESSION_NAME) throw createMissingConfigError();

    providerConfig = {
      ...baseConfig,
      credentialType: 'ram_role_arn',
      policy: ALIBABA_CLOUD_STS_POLICY,
      roleArn: ALIBABA_CLOUD_ROLE_ARN,
      roleSessionExpiration: ALIBABA_CLOUD_ROLE_SESSION_EXPIRATION,
      roleSessionName: ALIBABA_CLOUD_ROLE_SESSION_NAME,
      stsEndpoint: ALIBABA_CLOUD_STS_ENDPOINT,
    };
  } else if (ALIBABA_CLOUD_SECURITY_TOKEN) {
    providerConfig = {
      ...baseConfig,
      credentialType: 'sts',
      securityToken: ALIBABA_CLOUD_SECURITY_TOKEN,
    };
  } else {
    providerConfig = { ...baseConfig, credentialType: 'access_key' };
  }

  return new AliyunSmsProvider(providerConfig);
};

export type { SmsProvider } from './types';
