import type { PlatformModelRuntimeAdapter } from './types';

export const platformModelRuntimeAdapter: PlatformModelRuntimeAdapter = {
  getCapability: (config) =>
    config.platformHostedModels.enabled
      ? { enabled: true }
      : { enabled: false, reason: 'platform_hosted_models_disabled' },
  id: 'platform-model-runtime',
};
