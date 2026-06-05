// @vitest-environment node
import type { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AliyunSmsProvider } from '../impls/aliyun';

const sendSms = vi.fn();
const credentialValues: Record<string, unknown>[] = [];
const openApiConfigValues: Record<string, unknown>[] = [];
const requestValues: Record<string, unknown>[] = [];

vi.mock('@alicloud/dysmsapi20170525', () => ({
  SendSmsRequest: class MockSendSmsRequest {
    constructor(readonly value: Record<string, unknown>) {
      requestValues.push(value);
      Object.assign(this, value);
    }
  },
  default: class MockDysmsClient {
    sendSms = sendSms;
  },
}));

vi.mock('@alicloud/openapi-core/dist/utils', () => ({
  Config: class MockConfig {
    constructor(readonly value: Record<string, unknown>) {
      openApiConfigValues.push(value);
    }
  },
}));

vi.mock('@alicloud/credentials', () => ({
  Config: class MockCredentialConfig {
    constructor(readonly value: Record<string, unknown>) {
      credentialValues.push(value);
    }
  },
  __esModule: true,
  default: class MockCredential {
    constructor(readonly config: { value: Record<string, unknown> }) {}
  },
}));

describe('AliyunSmsProvider', () => {
  beforeEach(() => {
    sendSms.mockReset();
    credentialValues.length = 0;
    openApiConfigValues.length = 0;
    requestValues.length = 0;
  });

  it('should create OpenAPI client with static AccessKey credentials by default', () => {
    new AliyunSmsProvider({
      accessKeyId: 'ak',
      accessKeySecret: 'secret',
      credentialType: 'access_key',
      regionId: 'cn-hangzhou',
      signName: 'LobeHub',
      templateCode: 'SMS_123456',
    });

    expect(credentialValues[0]).toEqual({
      accessKeyId: 'ak',
      accessKeySecret: 'secret',
      type: 'access_key',
    });
    expect(openApiConfigValues[0]).toMatchObject({
      endpoint: 'dysmsapi.aliyuncs.com',
      regionId: 'cn-hangzhou',
    });
    expect(openApiConfigValues[0]).toHaveProperty('credential');
  });

  it('should create OpenAPI client with STS temporary credentials when security token is configured', () => {
    new AliyunSmsProvider({
      accessKeyId: 'sts-ak',
      accessKeySecret: 'sts-secret',
      credentialType: 'sts',
      regionId: 'cn-hangzhou',
      securityToken: 'sts-token',
      signName: 'LobeHub',
      templateCode: 'SMS_123456',
    });

    expect(credentialValues[0]).toEqual({
      accessKeyId: 'sts-ak',
      accessKeySecret: 'sts-secret',
      securityToken: 'sts-token',
      type: 'sts',
    });
    expect(openApiConfigValues[0]).toMatchObject({
      endpoint: 'dysmsapi.aliyuncs.com',
      regionId: 'cn-hangzhou',
    });
    expect(openApiConfigValues[0]).toHaveProperty('credential');
  });

  it('should create OpenAPI client with RAM Role ARN credentials when role config is configured', () => {
    new AliyunSmsProvider({
      accessKeyId: 'role-ak',
      accessKeySecret: 'role-secret',
      credentialType: 'ram_role_arn',
      policy: '{"Version":"1","Statement":[]}',
      regionId: 'cn-hangzhou',
      roleArn: 'acs:ram::1234567890123456:role/lobehub-sms',
      roleSessionExpiration: 3600,
      roleSessionName: 'lobehub-sms',
      signName: 'LobeHub',
      stsEndpoint: 'sts.cn-hangzhou.aliyuncs.com',
      templateCode: 'SMS_123456',
    });

    expect(credentialValues[0]).toEqual({
      accessKeyId: 'role-ak',
      accessKeySecret: 'role-secret',
      policy: '{"Version":"1","Statement":[]}',
      roleArn: 'acs:ram::1234567890123456:role/lobehub-sms',
      roleSessionExpiration: 3600,
      roleSessionName: 'lobehub-sms',
      stsEndpoint: 'sts.cn-hangzhou.aliyuncs.com',
      type: 'ram_role_arn',
    });
    expect(openApiConfigValues[0]).toMatchObject({
      endpoint: 'dysmsapi.aliyuncs.com',
      regionId: 'cn-hangzhou',
    });
    expect(openApiConfigValues[0]).toHaveProperty('credential');
  });

  it('should send verification code and return request identifiers when Aliyun returns OK', async () => {
    sendSms.mockResolvedValue({
      body: { bizId: 'biz-1', code: 'OK', message: 'OK', requestId: 'req-1' },
    });

    const provider = new AliyunSmsProvider({
      accessKeyId: 'ak',
      accessKeySecret: 'secret',
      credentialType: 'access_key',
      regionId: 'cn-hangzhou',
      signName: 'LobeHub',
      templateCode: 'SMS_123456',
    });

    const result = await provider.sendVerificationCode({
      code: '123456',
      phoneNumber: '+8613800000000',
    });

    expect(requestValues[0]).toEqual({
      phoneNumbers: '+8613800000000',
      signName: 'LobeHub',
      templateCode: 'SMS_123456',
      templateParam: JSON.stringify({ code: '123456' }),
    });
    expect(sendSms).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ bizId: 'biz-1', requestId: 'req-1' });
  });

  it('should throw SERVICE_UNAVAILABLE when Aliyun returns non-OK code', async () => {
    sendSms.mockResolvedValue({
      body: { code: 'isv.BUSINESS_LIMIT_CONTROL', message: 'rate limited', requestId: 'req-2' },
    });

    const provider = new AliyunSmsProvider({
      accessKeyId: 'ak',
      accessKeySecret: 'secret',
      credentialType: 'access_key',
      regionId: 'cn-hangzhou',
      signName: 'LobeHub',
      templateCode: 'SMS_123456',
    });

    await expect(
      provider.sendVerificationCode({ code: '123456', phoneNumber: '+8613800000000' }),
    ).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' } satisfies Partial<TRPCError>);
  });
});
