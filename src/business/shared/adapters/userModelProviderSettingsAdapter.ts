import type { CommercialRuntimeConfig } from '../commercialRuntime';

export const userModelProviderSettingsAdapter = {
  canUseUserProviderSettings: (config: CommercialRuntimeConfig) =>
    !config.platformHostedModels.enabled,
  canWriteModelProviderKeyVaults: (config: CommercialRuntimeConfig) =>
    !config.platformHostedModels.enabled,
};
