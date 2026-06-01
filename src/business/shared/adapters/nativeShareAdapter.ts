import type { ShareAdapter } from './types';

export const nativeShareAdapter: ShareAdapter = {
  getCapability: () => ({ enabled: false, reason: 'native_adapter_not_implemented' }),
  id: 'native-share',
};

// TODO(native-adapter): Implement nativeShare service, public links, permission checks, revocation, and audit logs.
