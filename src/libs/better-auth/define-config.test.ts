import type { BetterAuthOptions } from 'better-auth/minimal';
import type { GenericOAuthConfig } from 'better-auth/plugins';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authEnv: {
    AUTH_DISABLE_EMAIL_PASSWORD: false,
    AUTH_EMAIL_VERIFICATION: true,
    AUTH_ENABLE_MAGIC_LINK: false,
    AUTH_SECRET: 'test-secret',
    AUTH_SSO_PROVIDERS: '',
    WECHAT_CLIENT_ID: 'wechat-client-id' as string | undefined,
    WECHAT_CLIENT_SECRET: 'wechat-client-secret' as string | undefined,
  },
  betterAuth: vi.fn((options) => options),
  createAliyunSmsProvider: vi.fn(),
  initBetterAuthSSOProviders: vi.fn(() => ({
    genericOAuthProviders: [] as GenericOAuthConfig[],
    socialProviders: {},
  })),
  onBusinessUserPhoneVerified: vi.fn(),
}));

vi.mock('@better-auth/expo', () => ({
  expo: vi.fn(() => ({ id: 'expo' })),
}));

vi.mock('@better-auth/passkey', () => ({
  passkey: vi.fn(() => ({ id: 'passkey' })),
}));

vi.mock('@lobechat/business-const', () => ({
  ENABLE_BUSINESS_FEATURES: false,
}));

vi.mock('@lobechat/database', () => ({
  createNanoId: vi.fn(() => vi.fn(() => 'generated-id')),
  idGenerator: vi.fn(() => 'generated-user-id'),
  serverDB: {},
}));

vi.mock('@lobechat/database/schemas', () => ({}));

vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
  },
}));

vi.mock('better-auth/adapters/drizzle', () => ({
  drizzleAdapter: vi.fn(() => ({ id: 'drizzle-adapter' })),
}));

vi.mock('better-auth/crypto', () => ({
  verifyPassword: vi.fn(),
}));

vi.mock('better-auth/minimal', () => ({
  betterAuth: mocks.betterAuth,
}));

vi.mock('better-auth/plugins', () => ({
  admin: vi.fn(() => ({ id: 'admin' })),
  emailOTP: vi.fn(() => ({ id: 'email-otp' })),
  genericOAuth: vi.fn(() => ({ id: 'generic-oauth' })),
  magicLink: vi.fn(() => ({ id: 'magic-link' })),
  phoneNumber: vi.fn(() => ({ id: 'phone-number' })),
}));

vi.mock('better-auth-harmony', () => ({
  emailHarmony: vi.fn(() => ({ id: 'email-harmony' })),
}));

vi.mock('better-auth-harmony/email', () => ({
  validateEmail: vi.fn(),
}));

vi.mock('undici', () => ({
  ProxyAgent: vi.fn(),
  setGlobalDispatcher: vi.fn(),
}));

vi.mock('@/business/server/better-auth', () => ({
  businessEmailValidator: vi.fn(),
}));

vi.mock('@/business/server/user', () => ({
  onBusinessUserPhoneVerified: mocks.onBusinessUserPhoneVerified,
}));

vi.mock('@/envs/app', () => ({
  appEnv: {
    APP_URL: 'https://example.com',
  },
}));

vi.mock('@/envs/auth', () => ({
  authEnv: mocks.authEnv,
}));

vi.mock('@/libs/better-auth/email-templates', () => ({
  getChangeEmailVerificationTemplate: vi.fn(() => ({})),
  getMagicLinkEmailTemplate: vi.fn(() => ({})),
  getResetPasswordEmailTemplate: vi.fn(() => ({})),
  getVerificationEmailTemplate: vi.fn(() => ({})),
  getVerificationOTPEmailTemplate: vi.fn(() => ({})),
}));

vi.mock('@/libs/better-auth/plugins/email-whitelist', () => ({
  emailWhitelist: vi.fn(() => ({ id: 'email-whitelist' })),
}));

vi.mock('@/libs/better-auth/sso', () => ({
  initBetterAuthSSOProviders: mocks.initBetterAuthSSOProviders,
}));

vi.mock('@/libs/better-auth/utils/config', () => ({
  createSecondaryStorage: vi.fn(() => ({ id: 'secondary-storage' })),
  getTrustedOrigins: vi.fn(() => ['https://example.com']),
}));

vi.mock('@/libs/better-auth/utils/server', () => ({
  parseSSOProviders: vi.fn(() => []),
}));

vi.mock('@/server/services/email', () => ({
  EmailService: vi.fn(),
}));

vi.mock('@/server/services/sms', () => ({
  createAliyunSmsProvider: mocks.createAliyunSmsProvider,
}));

vi.mock('@/server/services/user', () => ({
  UserService: vi.fn(),
}));

describe('defineConfig', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    mocks.authEnv.WECHAT_CLIENT_ID = 'wechat-client-id';
    mocks.authEnv.WECHAT_CLIENT_SECRET = 'wechat-client-secret';
    mocks.initBetterAuthSSOProviders.mockReturnValue({
      genericOAuthProviders: [] as GenericOAuthConfig[],
      socialProviders: {},
    });
  });

  it('should revoke existing sessions after password reset by default', async () => {
    const { defineConfig } = await import('./define-config');

    defineConfig({ plugins: [] });

    expect(mocks.betterAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        emailAndPassword: expect.objectContaining({
          revokeSessionsOnPasswordReset: true,
        }),
      }),
    );
  });

  it('should register super-admin as a Better Auth admin role', async () => {
    const { admin } = await import('better-auth/plugins');
    const { SUPER_ADMIN_ROLE } = await import('@/const/authRoles');
    const { defineConfig } = await import('./define-config');

    defineConfig({ plugins: [] });

    expect(admin).toHaveBeenCalledWith(
      expect.objectContaining({
        adminRoles: [SUPER_ADMIN_ROLE],
        roles: expect.objectContaining({
          [SUPER_ADMIN_ROLE]: expect.anything(),
        }),
      }),
    );
  });

  it('should grant trial credits after phone verification succeeds', async () => {
    const { defineConfig } = await import('./define-config');

    const options = defineConfig({ plugins: [] }) as unknown as BetterAuthOptions;
    const afterUpdate = options.databaseHooks?.user?.update?.after;

    expect(afterUpdate).toBeDefined();

    await afterUpdate?.(
      {
        createdAt: new Date('2026-05-29T00:00:00Z'),
        email: 'phone@example.com',
        emailVerified: true,
        id: 'user-phone-verified',
        image: null,
        name: 'Phone User',
        phone: '+8613800000000',
        phoneNumberVerified: true,
        updatedAt: new Date('2026-05-29T00:00:00Z'),
      },
      {} as never,
    );

    expect(mocks.onBusinessUserPhoneVerified).toHaveBeenCalledWith({
      db: {},
      phoneNumber: '+8613800000000',
      userId: 'user-phone-verified',
    });
  });

  it('should register phone OTP backed by Aliyun SMS', async () => {
    const smsProvider = {
      sendVerificationCode: vi.fn(),
    };
    mocks.createAliyunSmsProvider.mockReturnValue(smsProvider);

    const { phoneNumber } = await import('better-auth/plugins');
    const { defineConfig } = await import('./define-config');

    defineConfig({ plugins: [] });

    expect(phoneNumber).toHaveBeenCalledWith(
      expect.objectContaining({
        expiresIn: 300,
        otpLength: 6,
      }),
    );

    const lastPhoneNumberCall = vi.mocked(phoneNumber).mock.calls.at(-1);
    if (!lastPhoneNumberCall) {
      throw new Error('phoneNumber plugin was not registered');
    }

    const [options] = lastPhoneNumberCall;
    await options.sendOTP({ code: '123456', phoneNumber: '+8613800000000' });

    expect(mocks.createAliyunSmsProvider).toHaveBeenCalled();
    expect(smsProvider.sendVerificationCode).toHaveBeenCalledWith({
      code: '123456',
      phoneNumber: '+8613800000000',
    });
  });

  it('should not register unsupported direct WeChat social provider', async () => {
    mocks.initBetterAuthSSOProviders.mockReturnValue({
      genericOAuthProviders: [
        {
          clientId: 'sso-wechat-client-id',
          clientSecret: 'sso-wechat-client-secret',
          providerId: 'wechat',
        },
      ],
      socialProviders: {},
    });

    const { defineConfig } = await import('./define-config');

    const options = defineConfig({ plugins: [] }) as unknown as BetterAuthOptions;

    expect(options.socialProviders).not.toHaveProperty('wechat');
  });
});
