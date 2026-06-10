export const PLATFORM_PROVIDER_DISABLED = 'PLATFORM_PROVIDER_DISABLED';
export const PLATFORM_MODEL_DISABLED = 'PLATFORM_MODEL_DISABLED';
export const PLATFORM_MODEL_CREDENTIAL_MISSING = 'PLATFORM_MODEL_CREDENTIAL_MISSING';

const PLATFORM_ERROR_MESSAGES = {
  [PLATFORM_MODEL_CREDENTIAL_MISSING]: 'Platform hosted model credential is missing',
  [PLATFORM_MODEL_DISABLED]: 'Platform model is disabled',
  [PLATFORM_PROVIDER_DISABLED]: 'Platform provider is disabled',
} as const;

export type PlatformProviderErrorCode = keyof typeof PLATFORM_ERROR_MESSAGES;

export interface PlatformProviderErrorBody {
  code: PlatformProviderErrorCode;
  message: string;
  provider?: string;
}

const isRecord = (value: unknown): value is Record<PropertyKey, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export const isPlatformProviderErrorCode = (value: unknown): value is PlatformProviderErrorCode =>
  typeof value === 'string' && value in PLATFORM_ERROR_MESSAGES;

export const getPlatformProviderErrorMessage = (code: PlatformProviderErrorCode) =>
  PLATFORM_ERROR_MESSAGES[code];

export const getPlatformProviderErrorCode = (error: unknown): PlatformProviderErrorCode | undefined => {
  if (!isRecord(error)) return;

  if (isPlatformProviderErrorCode(error.code)) return error.code;
  if (isPlatformProviderErrorCode(error.message)) return error.message;

  return;
};

export const getPlatformProviderErrorBody = (error: unknown): PlatformProviderErrorBody | undefined => {
  const code = getPlatformProviderErrorCode(error);
  if (!code) return;

  const meta = isRecord(error) && isRecord(error.meta) ? error.meta : undefined;
  const provider = typeof meta?.provider === 'string' ? meta.provider : undefined;

  return {
    code,
    message:
      error instanceof Error && error.message !== code
        ? error.message
        : getPlatformProviderErrorMessage(code),
    provider,
  };
};
