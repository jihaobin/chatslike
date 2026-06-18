import { type UserState } from '@/store/user/initialState';

export const labPreferSelectors = {
  enableAgentSelfIteration: (s: UserState): boolean =>
    s.preference.lab?.enableAgentSelfIteration ?? false,
  // Advanced settings panel removed: pinned to a fixed value, no longer reads user preference.
  enableExecutionDeviceSwitcher: (): boolean => false,
  enableGatewayMode: (s: UserState): boolean => s.preference.lab?.enableGatewayMode ?? false,
  // Advanced settings panel removed: pinned to a fixed value, no longer reads user preference.
  enableInputMarkdown: (): boolean => true,
  enablePlatformAgent: (s: UserState): boolean => s.preference.lab?.enablePlatformAgent ?? false,
};
