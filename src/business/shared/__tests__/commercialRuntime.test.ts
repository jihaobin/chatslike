// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  getCommercialRuntimeConfig,
  getCommercialRuntimeEnv,
  isCommercialEnabled,
  isLobeHubCloudIntegrationEnabled,
  isNativeBillingEnabled,
  isPlatformHostedModelsEnabled,
} from '../commercialRuntime';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const runtimeSourcePath = path.join(dirname, '../commercialRuntime.ts');

describe('commercial runtime config', () => {
  it('keeps all commercial gates disabled by default', () => {
    expect(getCommercialRuntimeConfig({})).toEqual({
      commercial: { enabled: false },
      lobeHubCloudIntegration: { enabled: false },
      nativeBilling: { enabled: false },
      platformHostedModels: { enabled: false },
    });
  });

  it('maps legacy platform billing env to native billing and hosted models', () => {
    expect(
      getCommercialRuntimeConfig({
        NEXT_PUBLIC_ENABLE_PLATFORM_BILLING: '1',
      }),
    ).toEqual({
      commercial: { enabled: true },
      lobeHubCloudIntegration: { enabled: false },
      nativeBilling: { enabled: true },
      platformHostedModels: { enabled: true },
    });
  });

  it('constructs default runtime env from direct process.env member reads', () => {
    const source = readFileSync(runtimeSourcePath, 'utf8');

    expect(source).not.toContain('= process.env');
    expect(source).toContain(
      'NEXT_PUBLIC_ENABLE_PLATFORM_BILLING: process.env.NEXT_PUBLIC_ENABLE_PLATFORM_BILLING',
    );
  });

  it('exposes a pure default runtime env helper', () => {
    const env = getCommercialRuntimeEnv({
      ENABLE_COMMERCIAL: '1',
      NEXT_PUBLIC_ENABLE_PLATFORM_BILLING: '1',
    });

    expect(env).toEqual({
      ENABLE_COMMERCIAL: '1',
      ENABLE_LOBEHUB_CLOUD_INTEGRATION: undefined,
      ENABLE_NATIVE_BILLING: undefined,
      ENABLE_PLATFORM_HOSTED_MODELS: undefined,
      NEXT_PUBLIC_ENABLE_PLATFORM_BILLING: '1',
    });
  });

  it('allows explicit native billing and hosted model gates without official cloud integration', () => {
    expect(
      getCommercialRuntimeConfig({
        ENABLE_COMMERCIAL: '1',
        ENABLE_LOBEHUB_CLOUD_INTEGRATION: '0',
        ENABLE_NATIVE_BILLING: '1',
        ENABLE_PLATFORM_HOSTED_MODELS: '1',
      }),
    ).toEqual({
      commercial: { enabled: true },
      lobeHubCloudIntegration: { enabled: false },
      nativeBilling: { enabled: true },
      platformHostedModels: { enabled: true },
    });
  });

  it('keeps official cloud integration opt-in and independent', () => {
    expect(
      getCommercialRuntimeConfig({
        ENABLE_COMMERCIAL: '1',
        ENABLE_LOBEHUB_CLOUD_INTEGRATION: '1',
      }),
    ).toEqual({
      commercial: { enabled: true },
      lobeHubCloudIntegration: { enabled: true },
      nativeBilling: { enabled: false },
      platformHostedModels: { enabled: false },
    });
  });

  it('exposes pure helpers for each gate', () => {
    const config = getCommercialRuntimeConfig({
      ENABLE_COMMERCIAL: '1',
      ENABLE_NATIVE_BILLING: '1',
    });

    expect(isCommercialEnabled(config)).toBe(true);
    expect(isNativeBillingEnabled(config)).toBe(true);
    expect(isPlatformHostedModelsEnabled(config)).toBe(false);
    expect(isLobeHubCloudIntegrationEnabled(config)).toBe(false);
  });
});
