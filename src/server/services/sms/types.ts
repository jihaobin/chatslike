export interface SendVerificationCodeParams {
  code: string;
  phoneNumber: string;
}

export interface SendVerificationCodeResult {
  bizId?: string;
  requestId?: string;
}

export interface SmsProvider {
  sendVerificationCode: (params: SendVerificationCodeParams) => Promise<SendVerificationCodeResult>;
}

export type AliyunSmsCredentialType = 'access_key' | 'ram_role_arn' | 'sts';

export interface AliyunSmsBaseProviderConfig {
  accessKeyId: string;
  accessKeySecret: string;
  endpoint?: string;
  regionId: string;
  signName: string;
  templateCode: string;
}

export interface AliyunSmsAccessKeyProviderConfig extends AliyunSmsBaseProviderConfig {
  credentialType: 'access_key';
}

export interface AliyunSmsStsProviderConfig extends AliyunSmsBaseProviderConfig {
  credentialType: 'sts';
  securityToken: string;
}

export interface AliyunSmsRamRoleArnProviderConfig extends AliyunSmsBaseProviderConfig {
  credentialType: 'ram_role_arn';
  policy?: string;
  roleArn: string;
  roleSessionExpiration?: number;
  roleSessionName: string;
  stsEndpoint?: string;
}

export type AliyunSmsProviderConfig =
  | AliyunSmsAccessKeyProviderConfig
  | AliyunSmsRamRoleArnProviderConfig
  | AliyunSmsStsProviderConfig;
