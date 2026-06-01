import type { BillingAdapter } from './types';

export const nativeBillingAdapter: BillingAdapter = {
  getCapability: (config) =>
    config.nativeBilling.enabled
      ? { enabled: true }
      : { enabled: false, reason: 'native_billing_disabled' },
  id: 'native-billing',
};

// TODO(native-adapter): Move nativeBilling Plans/Credits/Usage/Billing pages and services behind this adapter.
