import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAuthClient: vi.fn(() => ({
    phoneNumber: {
      sendOtp: vi.fn(),
      verify: vi.fn(),
    },
  })),
  getElectronStoreState: vi.fn(() => ({ sync: {} })),
  remoteServerUrl: vi.fn(() => 'https://desktop.example.com'),
}));

vi.mock('better-auth/client/plugins', () => ({
  adminClient: vi.fn(() => ({ id: 'admin-client' })),
  genericOAuthClient: vi.fn(() => ({ id: 'generic-oauth-client' })),
  inferAdditionalFields: vi.fn(() => ({ id: 'infer-additional-fields' })),
  phoneNumberClient: vi.fn(() => ({ id: 'phone-number-client' })),
}));

vi.mock('better-auth/react', () => ({
  createAuthClient: mocks.createAuthClient,
}));

vi.mock('@/auth', () => ({
  auth: {},
}));

vi.mock('@/store/electron/selectors/sync', () => ({
  electronSyncSelectors: {
    remoteServerUrl: mocks.remoteServerUrl,
  },
}));

vi.mock('@/store/electron/store', () => ({
  getElectronStoreState: mocks.getElectronStoreState,
}));

describe('auth-client.desktop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports a lazy phoneNumber client object', async () => {
    const { phoneNumber } = await import('./auth-client.desktop');

    await phoneNumber.sendOtp({ phoneNumber: '+8613800000000' });
    await phoneNumber.verify({ code: '123456', phoneNumber: '+8613800000000' });

    const client = mocks.createAuthClient.mock.results[0].value;

    expect(mocks.createAuthClient).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: 'https://desktop.example.com',
      }),
    );
    expect(client.phoneNumber.sendOtp).toHaveBeenCalledWith({ phoneNumber: '+8613800000000' });
    expect(client.phoneNumber.verify).toHaveBeenCalledWith({
      code: '123456',
      phoneNumber: '+8613800000000',
    });
  });
});
