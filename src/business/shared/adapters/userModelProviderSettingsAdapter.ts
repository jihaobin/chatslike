import type { CommercialRuntimeConfig } from '../commercialRuntime';
import type { UserModelProviderSettingsAdapter } from './types';

const isPlatformModelOnly = (config: CommercialRuntimeConfig) =>
  config.platformHostedModels.enabled;

export const userModelProviderSettingsAdapter: UserModelProviderSettingsAdapter = {
  canUseCustomModelProviders: (config) => !isPlatformModelOnly(config),
  canUseUserProviderSettings: (config) => !isPlatformModelOnly(config),
  canWriteModelProviderKeyVaults: (config) => !isPlatformModelOnly(config),
  getCapability: (config) =>
    isPlatformModelOnly(config)
      ? { enabled: false, reason: 'platform_model_only' }
      : { enabled: true },
  id: 'user-model-provider-settings',
  isPlatformModelOnly,
};
