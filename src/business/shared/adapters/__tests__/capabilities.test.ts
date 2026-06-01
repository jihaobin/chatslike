// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  lobeHubCloudAdapter,
  nativeBillingAdapter,
  nativeNotificationAdapter,
  nativeReferralAdapter,
  nativeShareAdapter,
  platformModelRuntimeAdapter,
} from '..';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const adaptersDir = path.resolve(dirname, '..');
const adapterTypesSource = readFileSync(path.join(adaptersDir, 'types.ts'), 'utf8');

describe('commercial adapter capabilities', () => {
  it('enables native billing capability when native billing gate is enabled', () => {
    expect(
      nativeBillingAdapter.getCapability({
        commercial: { enabled: true },
        lobeHubCloudIntegration: { enabled: false },
        nativeBilling: { enabled: true },
        platformHostedModels: { enabled: true },
      }),
    ).toEqual({ enabled: true });
  });

  it('keeps unfinished native adapters hidden by default', () => {
    const config = {
      commercial: { enabled: true },
      lobeHubCloudIntegration: { enabled: false },
      nativeBilling: { enabled: true },
      platformHostedModels: { enabled: true },
    };

    expect(nativeNotificationAdapter.getCapability(config)).toEqual({
      enabled: false,
      reason: 'native_adapter_not_implemented',
    });
    expect(nativeReferralAdapter.getCapability(config)).toEqual({
      enabled: false,
      reason: 'native_adapter_not_implemented',
    });
    expect(nativeShareAdapter.getCapability(config)).toEqual({
      enabled: false,
      reason: 'native_adapter_not_implemented',
    });
  });

  it('keeps official cloud adapter opt-in', () => {
    expect(
      lobeHubCloudAdapter.getCapability({
        commercial: { enabled: true },
        lobeHubCloudIntegration: { enabled: false },
        nativeBilling: { enabled: true },
        platformHostedModels: { enabled: true },
      }),
    ).toEqual({ enabled: false, reason: 'lobehub_cloud_integration_disabled' });

    expect(
      lobeHubCloudAdapter.getCapability({
        commercial: { enabled: true },
        lobeHubCloudIntegration: { enabled: true },
        nativeBilling: { enabled: false },
        platformHostedModels: { enabled: false },
      }),
    ).toEqual({ enabled: true });
  });

  it('enables platform model runtime capability from hosted model gate', () => {
    expect(
      platformModelRuntimeAdapter.getCapability({
        commercial: { enabled: true },
        lobeHubCloudIntegration: { enabled: false },
        nativeBilling: { enabled: true },
        platformHostedModels: { enabled: true },
      }),
    ).toEqual({ enabled: true });

    expect(
      platformModelRuntimeAdapter.getCapability({
        commercial: { enabled: false },
        lobeHubCloudIntegration: { enabled: false },
        nativeBilling: { enabled: false },
        platformHostedModels: { enabled: false },
      }),
    ).toEqual({ enabled: false, reason: 'platform_hosted_models_disabled' });
  });

  it('types adapter capability as a discriminated union', () => {
    expect(adapterTypesSource).toContain('enabled: true');
    expect(adapterTypesSource).toContain('enabled: false');
    expect(adapterTypesSource).toContain('reason: CommercialAdapterDisabledReason');
    expect(adapterTypesSource).not.toContain('reason?: CommercialAdapterDisabledReason');
  });

  it('keeps feature adapter ids implementation-agnostic', () => {
    expect(adapterTypesSource).not.toContain("id: 'native-billing'");
    expect(adapterTypesSource).not.toContain("id: 'native-notification'");
    expect(adapterTypesSource).not.toContain("id: 'native-referral'");
    expect(adapterTypesSource).not.toContain("id: 'native-share'");
  });

  it('keeps native adapter TODO markers searchable', () => {
    for (const file of [
      'nativeBillingAdapter.ts',
      'nativeNotificationAdapter.ts',
      'nativeReferralAdapter.ts',
      'nativeShareAdapter.ts',
    ]) {
      const source = readFileSync(path.join(adaptersDir, file), 'utf8');

      expect(source).toContain('TODO(native-adapter)');
    }
  });
});
