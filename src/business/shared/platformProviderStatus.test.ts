// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { getPlatformProviderStatus } from './platformProviderStatus';

describe('getPlatformProviderStatus', () => {
  it('exposes platform provider credential status without leaking credential values', () => {
    const status = getPlatformProviderStatus({
      NEWAPI_API_KEY: 'newapi-secret',
    });

    expect(status).toEqual([
      { configured: true, credentialKey: 'NEWAPI_API_KEY', provider: 'newapi' },
    ]);
    expect(JSON.stringify(status)).not.toContain('newapi-secret');
  });
});
