import type { LobeHubCloudAdapter } from './types';

export const lobeHubCloudAdapter: LobeHubCloudAdapter = {
  getCapability: (config) =>
    config.lobeHubCloudIntegration.enabled
      ? { enabled: true }
      : { enabled: false, reason: 'lobehub_cloud_integration_disabled' },
  id: 'lobehub-cloud',
};
