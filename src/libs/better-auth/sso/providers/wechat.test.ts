import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authEnv: {
    AUTH_WECHAT_ID: undefined as string | undefined,
    AUTH_WECHAT_SECRET: undefined as string | undefined,
    WECHAT_CLIENT_ID: undefined as string | undefined,
    WECHAT_CLIENT_SECRET: undefined as string | undefined,
  },
}));

vi.mock('@/envs/auth', () => ({
  authEnv: mocks.authEnv,
}));

describe('WeChat SSO provider', () => {
  beforeEach(() => {
    vi.resetModules();

    mocks.authEnv.AUTH_WECHAT_ID = undefined;
    mocks.authEnv.AUTH_WECHAT_SECRET = undefined;
    mocks.authEnv.WECHAT_CLIENT_ID = undefined;
    mocks.authEnv.WECHAT_CLIENT_SECRET = undefined;
  });

  it('uses WeChat Open Platform credentials from WECHAT_CLIENT_ID and WECHAT_CLIENT_SECRET', async () => {
    mocks.authEnv.WECHAT_CLIENT_ID = 'wechat-client-id';
    mocks.authEnv.WECHAT_CLIENT_SECRET = 'wechat-client-secret';

    const { default: provider } = await import('./wechat');

    const env = provider.checkEnvs();

    expect(env).toEqual({
      WECHAT_CLIENT_ID: 'wechat-client-id',
      WECHAT_CLIENT_SECRET: 'wechat-client-secret',
    });
    expect(env && provider.build(env)).toEqual(
      expect.objectContaining({
        clientId: 'wechat-client-id',
        clientSecret: 'wechat-client-secret',
        providerId: 'wechat',
      }),
    );
  });

  it('keeps compatibility with AUTH_WECHAT_ID and AUTH_WECHAT_SECRET', async () => {
    mocks.authEnv.AUTH_WECHAT_ID = 'legacy-wechat-id';
    mocks.authEnv.AUTH_WECHAT_SECRET = 'legacy-wechat-secret';

    const { default: provider } = await import('./wechat');

    const env = provider.checkEnvs();

    expect(env).toEqual({
      WECHAT_CLIENT_ID: 'legacy-wechat-id',
      WECHAT_CLIENT_SECRET: 'legacy-wechat-secret',
    });
    expect(env && provider.build(env)).toEqual(
      expect.objectContaining({
        clientId: 'legacy-wechat-id',
        clientSecret: 'legacy-wechat-secret',
        providerId: 'wechat',
      }),
    );
  });

  it('prefers WECHAT_CLIENT_ID and WECHAT_CLIENT_SECRET over legacy names', async () => {
    mocks.authEnv.AUTH_WECHAT_ID = 'legacy-wechat-id';
    mocks.authEnv.AUTH_WECHAT_SECRET = 'legacy-wechat-secret';
    mocks.authEnv.WECHAT_CLIENT_ID = 'wechat-client-id';
    mocks.authEnv.WECHAT_CLIENT_SECRET = 'wechat-client-secret';

    const { default: provider } = await import('./wechat');

    const env = provider.checkEnvs();

    expect(env && provider.build(env)).toEqual(
      expect.objectContaining({
        clientId: 'wechat-client-id',
        clientSecret: 'wechat-client-secret',
      }),
    );
  });
});
