import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import useBusinessMenuItems from './useBusinessMenuItems';

const state = vi.hoisted(() => ({
  enablePlatformBilling: true,
}));

vi.mock('@lobehub/ui', () => ({
  Icon: ({ icon: Icon }: { icon: any }) => <Icon />,
}));

vi.mock('lucide-react', () => {
  const Icon = () => <svg data-testid="icon" />;

  return {
    ChartColumnBigIcon: Icon,
    Coins: Icon,
    CreditCard: Icon,
    Map: Icon,
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/business/shared/platformModels', () => ({
  isPlatformBillingEnabled: () => state.enablePlatformBilling,
}));

describe('useBusinessMenuItems', () => {
  it('returns billing navigation items for signed-in users', () => {
    state.enablePlatformBilling = true;

    const { result } = renderHook(() => useBusinessMenuItems(true));
    const keys = result.current.map((item) => item?.key);

    expect(keys).toEqual(
      expect.arrayContaining([
        'business-plans',
        'business-credits',
        'business-usage',
        'business-billing',
      ]),
    );
  });

  it('hides billing navigation items for anonymous users', () => {
    state.enablePlatformBilling = true;

    const { result } = renderHook(() => useBusinessMenuItems(false));

    expect(result.current).toEqual([]);
  });

  it('hides billing navigation items when platform billing is disabled', () => {
    state.enablePlatformBilling = false;

    const { result } = renderHook(() => useBusinessMenuItems(true));

    expect(result.current).toEqual([]);
  });
});
