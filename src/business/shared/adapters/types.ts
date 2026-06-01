import type { CommercialRuntimeConfig } from '../commercialRuntime';

export type CommercialAdapterDisabledReason =
  | 'native_adapter_not_implemented'
  | 'native_billing_disabled'
  | 'platform_hosted_models_disabled'
  | 'lobehub_cloud_integration_disabled';

export type CommercialAdapterCapability =
  | {
      enabled: true;
    }
  | {
      enabled: false;
      reason: CommercialAdapterDisabledReason;
    };

export interface CommercialAdapter {
  getCapability: (config: CommercialRuntimeConfig) => CommercialAdapterCapability;
  id: string;
}

export interface BillingAdapter extends CommercialAdapter {}

export interface NotificationAdapter extends CommercialAdapter {}

export interface ReferralAdapter extends CommercialAdapter {}

export interface ShareAdapter extends CommercialAdapter {}

export interface LobeHubCloudAdapter extends CommercialAdapter {
  id: 'lobehub-cloud';
}

export interface PlatformModelRuntimeAdapter extends CommercialAdapter {
  id: 'platform-model-runtime';
}
