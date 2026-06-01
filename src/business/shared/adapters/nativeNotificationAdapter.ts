import type { NotificationAdapter } from './types';

export const nativeNotificationAdapter: NotificationAdapter = {
  getCapability: () => ({ enabled: false, reason: 'native_adapter_not_implemented' }),
  id: 'native-notification',
};

// TODO(native-adapter): Implement nativeNotification local data model, delivery state, and settings UI.
