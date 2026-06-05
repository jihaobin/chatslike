// @vitest-environment node
import { TRPCError } from '@trpc/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const providerValues: Record<string, unknown>[] = [];

vi.mock('../impls/aliyun', () => ({
  AliyunSmsProvider: class MockAliyunSmsProvider {
    constructor(readonly value: Record<string, unknown>) {
      providerValues.push(value);
    }
  },
}));

const originalEnv = { ...process.env };

const loadFactory = async () => {
  vi.resetModules();

  return import('../index');
};

describe('createAliyunSmsProvider', () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    providerValues.length = 0;
    vi.clearAllMocks();
  });

  it('should pass static AccessKey config to Aliyun provider', async () => {
    process.env = {
      ...originalEnv,
      ALIBABA_CLOUD_ACCESS_KEY_ID: 'ak',
      ALIBABA_CLOUD_ACCESS_KEY_SECRET: 'secret',
      ALIYUN_SMS_SIGN_NAME: 'LobeHub',
      ALIYUN_SMS_TEMPLATE_CODE: 'SMS_123456',
    };
    const { createAliyunSmsProvider } = await loadFactory();

    createAliyunSmsProvider();

    expect(providerValues[0]).toMatchObject({
      accessKeyId: 'ak',
      accessKeySecret: 'secret',
      credentialType: 'access_key',
      regionId: 'cn-hangzhou',
      signName: 'LobeHub',
      templateCode: 'SMS_123456',
    });
  });

  it('should pass STS temporary credential config to Aliyun provider when security token exists', async () => {
    process.env = {
      ...originalEnv,
      ALIBABA_CLOUD_ACCESS_KEY_ID: 'sts-ak',
      ALIBABA_CLOUD_ACCESS_KEY_SECRET: 'sts-secret',
      ALIBABA_CLOUD_SECURITY_TOKEN: 'sts-token',
      ALIYUN_SMS_SIGN_NAME: 'LobeHub',
      ALIYUN_SMS_TEMPLATE_CODE: 'SMS_123456',
    };
    const { createAliyunSmsProvider } = await loadFactory();

    createAliyunSmsProvider();

    expect(providerValues[0]).toMatchObject({
      accessKeyId: 'sts-ak',
      accessKeySecret: 'sts-secret',
      credentialType: 'sts',
      securityToken: 'sts-token',
    });
  });

  it('should pass RAM Role ARN config to Aliyun provider when role config is complete', async () => {
    process.env = {
      ...originalEnv,
      ALIBABA_CLOUD_ACCESS_KEY_ID: 'role-ak',
      ALIBABA_CLOUD_ACCESS_KEY_SECRET: 'role-secret',
      ALIBABA_CLOUD_ROLE_ARN: 'acs:ram::1234567890123456:role/lobehub-sms',
      ALIBABA_CLOUD_ROLE_SESSION_EXPIRATION: '3600',
      ALIBABA_CLOUD_ROLE_SESSION_NAME: 'lobehub-sms',
      ALIBABA_CLOUD_STS_ENDPOINT: 'sts.cn-hangzhou.aliyuncs.com',
      ALIBABA_CLOUD_STS_POLICY: '{"Version":"1","Statement":[]}',
      ALIYUN_SMS_SIGN_NAME: 'LobeHub',
      ALIYUN_SMS_TEMPLATE_CODE: 'SMS_123456',
    };
    const { createAliyunSmsProvider } = await loadFactory();

    createAliyunSmsProvider();

    expect(providerValues[0]).toMatchObject({
      accessKeyId: 'role-ak',
      accessKeySecret: 'role-secret',
      credentialType: 'ram_role_arn',
      policy: '{"Version":"1","Statement":[]}',
      roleArn: 'acs:ram::1234567890123456:role/lobehub-sms',
      roleSessionExpiration: 3600,
      roleSessionName: 'lobehub-sms',
      stsEndpoint: 'sts.cn-hangzhou.aliyuncs.com',
    });
  });

  it('should fail closed when RAM Role ARN config is incomplete', async () => {
    process.env = {
      ...originalEnv,
      ALIBABA_CLOUD_ACCESS_KEY_ID: 'ak',
      ALIBABA_CLOUD_ACCESS_KEY_SECRET: 'secret',
      ALIBABA_CLOUD_ROLE_ARN: 'acs:ram::1234567890123456:role/lobehub-sms',
      ALIYUN_SMS_SIGN_NAME: 'LobeHub',
      ALIYUN_SMS_TEMPLATE_CODE: 'SMS_123456',
    };
    const { createAliyunSmsProvider } = await loadFactory();

    expect(() => createAliyunSmsProvider()).toThrow(
      new TRPCError({ code: 'PRECONDITION_FAILED', message: 'SMS_CONFIG_MISSING' }),
    );
  });
});
