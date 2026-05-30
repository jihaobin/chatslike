import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const toastInfo = vi.hoisted(() => vi.fn());

vi.mock('@lobehub/ui', () => ({
  toast: {
    info: toastInfo,
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

import { useBusinessModelListGuard } from '../useBusinessModelListGuard';

describe('useBusinessModelListGuard', () => {
  beforeEach(() => {
    toastInfo.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('does not restrict models when platform billing is disabled', () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_PLATFORM_BILLING', '0');

    const { result } = renderHook(() => useBusinessModelListGuard());

    expect(result.current).toEqual({});
  });

  it('restricts custom providers when platform billing is enabled', () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_PLATFORM_BILLING', '1');

    const { result } = renderHook(() => useBusinessModelListGuard());

    expect(result.current.isModelRestricted?.('gpt-4o', 'openai')).toBe(false);
    expect(result.current.isModelRestricted?.('custom-model', 'custom-openai')).toBe(true);

    result.current.onRestrictedModelClick?.();

    expect(toastInfo).toHaveBeenCalledWith('Only platform hosted models are available');
  });
});
