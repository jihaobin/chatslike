// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { assertPlatformHostedProvider, isPlatformHostedProvider } from '../platformModels';

describe('platform hosted models', () => {
  it('allows configured platform providers', () => {
    expect(() => assertPlatformHostedProvider('openai')).not.toThrow();
    expect(isPlatformHostedProvider('lobehub')).toBe(true);
  });

  it('blocks user custom provider', () => {
    expect(() => assertPlatformHostedProvider('custom-openai')).toThrowError(
      'Only platform hosted models are available',
    );
    expect(isPlatformHostedProvider('custom-openai')).toBe(false);
  });
});
