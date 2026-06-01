export interface CommercialRuntimeConfig {
  commercial: {
    enabled: boolean;
  };
  lobeHubCloudIntegration: {
    enabled: boolean;
  };
  nativeBilling: {
    enabled: boolean;
  };
  platformHostedModels: {
    enabled: boolean;
  };
}

export interface CommercialRuntimeEnv {
  ENABLE_COMMERCIAL?: string;
  ENABLE_LOBEHUB_CLOUD_INTEGRATION?: string;
  ENABLE_NATIVE_BILLING?: string;
  ENABLE_PLATFORM_HOSTED_MODELS?: string;
  NEXT_PUBLIC_ENABLE_PLATFORM_BILLING?: string;
}

const enabled = (value: string | undefined) => value === '1';

export const getCommercialRuntimeEnv = (env: CommercialRuntimeEnv): CommercialRuntimeEnv => ({
  ENABLE_COMMERCIAL: env.ENABLE_COMMERCIAL,
  ENABLE_LOBEHUB_CLOUD_INTEGRATION: env.ENABLE_LOBEHUB_CLOUD_INTEGRATION,
  ENABLE_NATIVE_BILLING: env.ENABLE_NATIVE_BILLING,
  ENABLE_PLATFORM_HOSTED_MODELS: env.ENABLE_PLATFORM_HOSTED_MODELS,
  NEXT_PUBLIC_ENABLE_PLATFORM_BILLING: env.NEXT_PUBLIC_ENABLE_PLATFORM_BILLING,
});

const getDefaultCommercialRuntimeEnv = (): CommercialRuntimeEnv =>
  getCommercialRuntimeEnv({
    ENABLE_COMMERCIAL: process.env.ENABLE_COMMERCIAL,
    ENABLE_LOBEHUB_CLOUD_INTEGRATION: process.env.ENABLE_LOBEHUB_CLOUD_INTEGRATION,
    ENABLE_NATIVE_BILLING: process.env.ENABLE_NATIVE_BILLING,
    ENABLE_PLATFORM_HOSTED_MODELS: process.env.ENABLE_PLATFORM_HOSTED_MODELS,
    NEXT_PUBLIC_ENABLE_PLATFORM_BILLING: process.env.NEXT_PUBLIC_ENABLE_PLATFORM_BILLING,
  });

export const getCommercialRuntimeConfig = (env?: CommercialRuntimeEnv): CommercialRuntimeConfig => {
  const runtimeEnv = env ? getCommercialRuntimeEnv(env) : getDefaultCommercialRuntimeEnv();
  const legacyPlatformBilling = enabled(runtimeEnv.NEXT_PUBLIC_ENABLE_PLATFORM_BILLING);
  const nativeBilling = enabled(runtimeEnv.ENABLE_NATIVE_BILLING) || legacyPlatformBilling;
  const platformHostedModels =
    enabled(runtimeEnv.ENABLE_PLATFORM_HOSTED_MODELS) || legacyPlatformBilling;
  const lobeHubCloudIntegration = enabled(runtimeEnv.ENABLE_LOBEHUB_CLOUD_INTEGRATION);
  const commercial =
    enabled(runtimeEnv.ENABLE_COMMERCIAL) ||
    nativeBilling ||
    platformHostedModels ||
    lobeHubCloudIntegration;

  return {
    commercial: { enabled: commercial },
    lobeHubCloudIntegration: { enabled: lobeHubCloudIntegration },
    nativeBilling: { enabled: nativeBilling },
    platformHostedModels: { enabled: platformHostedModels },
  };
};

export const isCommercialEnabled = (config: CommercialRuntimeConfig) => config.commercial.enabled;

export const isNativeBillingEnabled = (config: CommercialRuntimeConfig) =>
  config.nativeBilling.enabled;

export const isPlatformHostedModelsEnabled = (config: CommercialRuntimeConfig) =>
  config.platformHostedModels.enabled;

export const isLobeHubCloudIntegrationEnabled = (config: CommercialRuntimeConfig) =>
  config.lobeHubCloudIntegration.enabled;

export const commercialRuntime = getCommercialRuntimeConfig();
