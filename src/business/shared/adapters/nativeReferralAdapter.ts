import type { ReferralAdapter } from './types';

export const nativeReferralAdapter: ReferralAdapter = {
  getCapability: () => ({ enabled: false, reason: 'native_adapter_not_implemented' }),
  id: 'native-referral',
};

// TODO(native-adapter): Implement nativeReferral codes, reward rules, anti-abuse checks, and credit grants.
