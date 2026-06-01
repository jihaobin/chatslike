import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useBusinessModelListGuard } from '../useBusinessModelListGuard';

const toastInfo = vi.hoisted(() => vi.fn());
const state = vi.hoisted(() => ({
  commercialRuntime: {
    platformHostedModels: {
      enabled: true,
    },
  },
}));

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

vi.mock('@/business/shared/commercialRuntime', () => ({
  commercialRuntime: state.commercialRuntime,
}));

describe('useBusinessModelListGuard', () => {
  beforeEach(() => {
    toastInfo.mockClear();
  });

  it('does not restrict models when platform hosted models are disabled', () => {
    state.commercialRuntime.platformHostedModels.enabled = false;

    const { result } = renderHook(() => useBusinessModelListGuard());

    expect(result.current).toEqual({});
  });

  it('restricts custom providers when platform hosted models are enabled', () => {
    state.commercialRuntime.platformHostedModels.enabled = true;

    const { result } = renderHook(() => useBusinessModelListGuard());

    expect(result.current.isModelRestricted?.('gpt-4o', 'openai')).toBe(false);
    expect(result.current.isModelRestricted?.('custom-model', 'custom-openai')).toBe(true);

    result.current.onRestrictedModelClick?.();

    expect(toastInfo).toHaveBeenCalledWith('Only platform hosted models are available');
  });
});
