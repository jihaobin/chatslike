import { ModelProvider } from 'model-bank';

declare module 'model-bank' {
  interface AiModelSettings extends PlatformModelMetadata {}
}

export const NEWAPI_PROVIDER_ID = ModelProvider.NewAPI;
export const PLATFORM_RUNTIME_PROVIDER = ModelProvider.NewAPI;
export const PLATFORM_CATALOG_USER_ID = 'platform-catalog';
export const NEWAPI_CREDENTIAL_KEYS = ['NEWAPI_API_KEY'] as const;

export interface PlatformModelMetadata {
  upstreamDisplayName?: string;
  upstreamProvider?: string;
}

export const getPlatformModelMetadata = (value: unknown): PlatformModelMetadata => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const record = value as Record<string, unknown>;

  return {
    upstreamDisplayName:
      typeof record.upstreamDisplayName === 'string' ? record.upstreamDisplayName : undefined,
    upstreamProvider:
      typeof record.upstreamProvider === 'string' ? record.upstreamProvider : undefined,
  };
};

export const normalizeUpstreamProvider = (value?: string | null) =>
  value?.trim().toLowerCase() || 'other';
