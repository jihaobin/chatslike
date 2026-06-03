import type { PlatformProviderStatusItem } from '@lobechat/types';
import { ModelProvider } from 'model-bank';

import { PLATFORM_HOSTED_PROVIDERS } from './platformModels';

const PLATFORM_PROVIDER_API_KEY_FIELDS = {
  [ModelProvider.NewAPI]: 'NEWAPI_API_KEY',
} as const satisfies Partial<Record<(typeof PLATFORM_HOSTED_PROVIDERS)[number], string>>;

export const getPlatformProviderCredentialKey = (provider: string) =>
  PLATFORM_PROVIDER_API_KEY_FIELDS[provider as keyof typeof PLATFORM_PROVIDER_API_KEY_FIELDS];

export const getPlatformProviderStatus = (llmConfig: Record<string, unknown>) =>
  PLATFORM_HOSTED_PROVIDERS.map((provider) => {
    const credentialKey = getPlatformProviderCredentialKey(provider);

    return {
      configured: credentialKey
        ? typeof llmConfig[credentialKey] === 'string' && llmConfig[credentialKey].trim().length > 0
        : true,
      credentialKey,
      provider,
    } satisfies PlatformProviderStatusItem;
  });
