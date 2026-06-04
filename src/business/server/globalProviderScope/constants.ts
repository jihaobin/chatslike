export { GLOBAL_PROVIDER_CONFIG_USER_ID } from '@/database/repositories/aiInfra/constants';

export const ProviderConfigScope = {
  Global: 'global',
  User: 'user',
} as const;

export type ProviderConfigScope = (typeof ProviderConfigScope)[keyof typeof ProviderConfigScope];

export interface ProviderConfigScopeSelector {
  scope?: ProviderConfigScope;
}

export const isGlobalProviderScope = (scope?: ProviderConfigScope) =>
  scope === ProviderConfigScope.Global;
