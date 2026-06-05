import Credential, { Config as CredentialConfig } from '@alicloud/credentials';
import DysmsapiClient, { SendSmsRequest } from '@alicloud/dysmsapi20170525';
import { Config as OpenApiConfig } from '@alicloud/openapi-core/dist/utils';
import { TRPCError } from '@trpc/server';

import type { AliyunSmsProviderConfig, SendVerificationCodeParams, SmsProvider } from '../types';

const createCredentialConfig = (config: AliyunSmsProviderConfig) => {
  switch (config.credentialType) {
    case 'ram_role_arn': {
      return new CredentialConfig({
        accessKeyId: config.accessKeyId,
        accessKeySecret: config.accessKeySecret,
        policy: config.policy,
        roleArn: config.roleArn,
        roleSessionExpiration: config.roleSessionExpiration,
        roleSessionName: config.roleSessionName,
        stsEndpoint: config.stsEndpoint,
        type: 'ram_role_arn',
      });
    }

    case 'sts': {
      return new CredentialConfig({
        accessKeyId: config.accessKeyId,
        accessKeySecret: config.accessKeySecret,
        securityToken: config.securityToken,
        type: 'sts',
      });
    }

    case 'access_key': {
      return new CredentialConfig({
        accessKeyId: config.accessKeyId,
        accessKeySecret: config.accessKeySecret,
        type: 'access_key',
      });
    }
  }
};

export class AliyunSmsProvider implements SmsProvider {
  private readonly client: DysmsapiClient;

  constructor(private readonly config: AliyunSmsProviderConfig) {
    this.client = new DysmsapiClient(
      new OpenApiConfig({
        credential: new Credential(createCredentialConfig(config)),
        endpoint: config.endpoint || 'dysmsapi.aliyuncs.com',
        regionId: config.regionId,
      }),
    );
  }

  async sendVerificationCode({ code, phoneNumber }: SendVerificationCodeParams) {
    try {
      const response = await this.client.sendSms(
        new SendSmsRequest({
          phoneNumbers: phoneNumber,
          signName: this.config.signName,
          templateCode: this.config.templateCode,
          templateParam: JSON.stringify({ code }),
        }),
      );

      if (response.body?.code !== 'OK') {
        throw new TRPCError({
          code: 'SERVICE_UNAVAILABLE',
          message: response.body?.message || 'SMS_SEND_FAILED',
        });
      }

      return {
        bizId: response.body.bizId,
        requestId: response.body.requestId,
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;

      throw new TRPCError({
        cause: error,
        code: 'SERVICE_UNAVAILABLE',
        message: 'SMS_SEND_FAILED',
      });
    }
  }
}
