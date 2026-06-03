import {
  isPlatformBillingEnabled,
  isPlatformHostedProvider,
  PLATFORM_HOSTED_PROVIDERS,
} from '@/business/shared/platformModels';
import { getPlatformProviderCredentialKey } from '@/business/shared/platformProviderStatus';

import { BillingError } from './errors';

export function assertPlatformHostedProvider(provider: string) {
  if (!isPlatformHostedProvider(provider)) {
    throw new BillingError('PLATFORM_MODEL_ONLY', 'Only platform hosted models are available', {
      provider,
    });
  }
}

export function assertPlatformHostedProviderConfigured(
  provider: string,
  llmConfig: Record<string, unknown>,
) {
  assertPlatformHostedProvider(provider);

  const apiKeyField = getPlatformProviderCredentialKey(provider);
  if (!apiKeyField) return;

  if (typeof llmConfig[apiKeyField] !== 'string' || llmConfig[apiKeyField].trim().length === 0) {
    throw new BillingError(
      'PLATFORM_MODEL_CREDENTIAL_MISSING',
      'Platform hosted model credential is missing',
      {
        credential: apiKeyField,
        provider,
      },
    );
  }
}

export { isPlatformBillingEnabled, isPlatformHostedProvider, PLATFORM_HOSTED_PROVIDERS };
