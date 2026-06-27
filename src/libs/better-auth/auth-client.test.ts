import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAuthClient: vi.fn(() => ({
    phoneNumber: {
      sendOtp: vi.fn(),
      verify: vi.fn(),
    },
  })),
  phoneNumberClient: vi.fn(() => ({ id: 'phone-number-client' })),
}));

vi.mock('better-auth/client/plugins', () => ({
  adminClient: vi.fn(() => ({ id: 'admin-client' })),
  genericOAuthClient: vi.fn(() => ({ id: 'generic-oauth-client' })),
  inferAdditionalFields: vi.fn(() => ({ id: 'infer-additional-fields' })),
  phoneNumberClient: mocks.phoneNumberClient,
}));

vi.mock('better-auth/react', () => ({
  createAuthClient: mocks.createAuthClient,
}));

vi.mock('@/auth', () => ({
  auth: {},
}));

describe('auth-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports the Better Auth phoneNumber client object', async () => {
    const { phoneNumber } = await import('./auth-client');
    const client = mocks.createAuthClient.mock.results[0].value;

    expect(phoneNumber).toBe(client.phoneNumber);
    expect(mocks.phoneNumberClient).toHaveBeenCalled();
    expect(mocks.createAuthClient).toHaveBeenCalledWith(
      expect.objectContaining({
        plugins: expect.arrayContaining([mocks.phoneNumberClient.mock.results[0].value]),
      }),
    );
  });
});
