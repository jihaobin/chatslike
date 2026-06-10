import { message } from '@/components/AntdStaticMethods';

interface PlatformProviderTRPCErrorData {
  code?: string;
  message?: string;
}

const isRecord = (value: unknown): value is Record<PropertyKey, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const getPlatformProviderErrorData = (error: unknown): PlatformProviderTRPCErrorData | undefined => {
  if (!isRecord(error) || !isRecord(error.data)) return;

  const errorData = error.data.errorData;
  if (!isRecord(errorData)) return;

  return {
    code: typeof errorData.code === 'string' ? errorData.code : undefined,
    message: typeof errorData.message === 'string' ? errorData.message : undefined,
  };
};

export const handlePlatformProviderError = (error: unknown) => {
  const errorData = getPlatformProviderErrorData(error);
  if (!errorData?.code?.startsWith('PLATFORM_')) return;

  message.error(errorData.message ?? (error instanceof Error ? error.message : errorData.code));
};
