import { type ServerConfigStore } from './store';

export const featureFlagsSelectors = (s: ServerConfigStore) => s.featureFlags;

export const serverConfigSelectors = {
  commercial: (s: ServerConfigStore) =>
    s.serverConfig.commercial || {
      commercial: { enabled: s.serverConfig.enableBusinessFeatures || false },
      lobeHubCloudIntegration: { enabled: false },
      nativeBilling: { enabled: false },
      platformHostedModels: { enabled: false },
    },
  commercialEnabled: (s: ServerConfigStore) =>
    serverConfigSelectors.commercial(s).commercial.enabled,
  disableEmailPassword: (s: ServerConfigStore) => s.serverConfig.disableEmailPassword || false,
  enableBusinessFeatures: (s: ServerConfigStore) => s.serverConfig.enableBusinessFeatures || false,
  enableEmailVerification: (s: ServerConfigStore) =>
    s.serverConfig.enableEmailVerification || false,
  enableKlavis: (s: ServerConfigStore) => s.serverConfig.enableKlavis || false,
  enableLobehubSkill: (s: ServerConfigStore) => s.serverConfig.enableLobehubSkill || false,
  enableMagicLink: (s: ServerConfigStore) => s.serverConfig.enableMagicLink || false,
  enableMarketTrustedClient: (s: ServerConfigStore) =>
    s.serverConfig.enableMarketTrustedClient || false,
  enableUploadFileToServer: (s: ServerConfigStore) => s.serverConfig.enableUploadFileToServer,
  enableVisualUnderstanding: (s: ServerConfigStore) =>
    s.serverConfig.enableVisualUnderstanding || false,
  enabledTelemetryChat: (s: ServerConfigStore) => s.serverConfig.telemetry.langfuse || false,
  isMobile: (s: ServerConfigStore) => s.isMobile || false,
  lobeHubCloudIntegrationEnabled: (s: ServerConfigStore) =>
    serverConfigSelectors.commercial(s).lobeHubCloudIntegration.enabled,
  nativeBillingEnabled: (s: ServerConfigStore) =>
    serverConfigSelectors.commercial(s).nativeBilling.enabled,
  oAuthSSOProviders: (s: ServerConfigStore) => s.serverConfig.oAuthSSOProviders,
  platformProviderStatus: (s: ServerConfigStore) => s.serverConfig.platformProviderStatus ?? [],
  platformHostedModelsEnabled: (s: ServerConfigStore) =>
    serverConfigSelectors.commercial(s).platformHostedModels.enabled,
  visualUnderstanding: (s: ServerConfigStore) => s.serverConfig.visualUnderstanding,
};
