import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authEnv: {
    AUTH_SSO_PROVIDERS: '',
    AUTH_WECHAT_ID: undefined as string | undefined,
    AUTH_WECHAT_SECRET: undefined as string | undefined,
    WECHAT_CLIENT_ID: undefined as string | undefined,
    WECHAT_CLIENT_SECRET: undefined as string | undefined,
  },
}));

vi.mock('@/envs/app', () => ({
  appEnv: {
    APP_URL: 'https://example.com',
  },
}));

vi.mock('@/envs/auth', () => ({
  authEnv: mocks.authEnv,
}));

describe('initBetterAuthSSOProviders', () => {
  beforeEach(() => {
    vi.resetModules();

    mocks.authEnv.AUTH_SSO_PROVIDERS = '';
    mocks.authEnv.AUTH_WECHAT_ID = undefined;
    mocks.authEnv.AUTH_WECHAT_SECRET = undefined;
    mocks.authEnv.WECHAT_CLIENT_ID = undefined;
    mocks.authEnv.WECHAT_CLIENT_SECRET = undefined;
  });

  it('configures WeChat as a generic OAuth provider with WECHAT_CLIENT credentials', async () => {
    mocks.authEnv.AUTH_SSO_PROVIDERS = 'wechat';
    mocks.authEnv.WECHAT_CLIENT_ID = 'wechat-client-id';
    mocks.authEnv.WECHAT_CLIENT_SECRET = 'wechat-client-secret';

    const { initBetterAuthSSOProviders } = await import('./index');

    const { genericOAuthProviders, socialProviders } = initBetterAuthSSOProviders();

    expect(socialProviders).not.toHaveProperty('wechat');
    expect(genericOAuthProviders).toEqual([
      expect.objectContaining({
        clientId: 'wechat-client-id',
        clientSecret: 'wechat-client-secret',
        providerId: 'wechat',
        redirectURI: 'https://example.com/api/auth/callback/wechat',
      }),
    ]);
  });
});
