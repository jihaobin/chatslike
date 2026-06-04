import type { CommercialRuntimeConfig } from '../commercialRuntime';
import type { UserModelProviderSettingsAdapter } from './types';

export const userModelProviderSettingsAdapter: UserModelProviderSettingsAdapter = {
  canUseCustomModelProviders: (config: CommercialRuntimeConfig) =>
    !config.platformHostedModels.enabled,
  canUseUserProviderSettings: (config: CommercialRuntimeConfig) =>
    !config.platformHostedModels.enabled,
  canWriteModelProviderKeyVaults: (config: CommercialRuntimeConfig) =>
    !config.platformHostedModels.enabled,
  getCapability: (config: CommercialRuntimeConfig) =>
    config.platformHostedModels.enabled
      ? { enabled: false, reason: 'platform_model_only' }
      : { enabled: true },
  id: 'user-model-provider-settings',
  isPlatformModelOnly: (config: CommercialRuntimeConfig) => config.platformHostedModels.enabled,
};
