import { ModelProvider } from 'model-bank';

export const PLATFORM_HOSTED_PROVIDERS = [
  ModelProvider.OpenAI,
  ModelProvider.Anthropic,
  ModelProvider.DeepSeek,
  ModelProvider.LobeHub,
] as const;

const PLATFORM_PROVIDER_SET = new Set<string>(PLATFORM_HOSTED_PROVIDERS);

/**
 * @deprecated Use `commercialRuntime.nativeBilling.enabled` or
 * `commercialRuntime.platformHostedModels.enabled` for new business gates.
 */
export function isPlatformBillingEnabled() {
  return process.env.NEXT_PUBLIC_ENABLE_PLATFORM_BILLING === '1';
}

export function isPlatformHostedProvider(provider: string) {
  return PLATFORM_PROVIDER_SET.has(provider);
}
