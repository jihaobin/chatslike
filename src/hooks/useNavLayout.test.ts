import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useNavLayout } from './useNavLayout';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/config/routes', () => ({
  getRouteById: (id: string) => ({
    icon: () => null,
    id,
  }),
}));

vi.mock('@/store/global', () => ({
  useGlobalStore: (selector: (state: { toggleCommandMenu: () => void }) => unknown) =>
    selector({ toggleCommandMenu: vi.fn() }),
}));

vi.mock('@/store/serverConfig', () => ({
  featureFlagsSelectors: (state: { hideGitHub?: boolean; showMarket?: boolean }) => state,
  useServerConfigStore: (selector: (state: { hideGitHub: boolean; showMarket: boolean }) => unknown) =>
    selector({ hideGitHub: false, showMarket: true }),
}));

describe('useNavLayout', () => {
  it('does not include the settings entry in the home sidebar bottom menu', () => {
    const { result } = renderHook(() => useNavLayout());

    expect(result.current.bottomMenuItems.some((item) => item.key === 'settings')).toBe(false);
  });

  it('does not include the generation entry in the home sidebar bottom menu', () => {
    const { result } = renderHook(() => useNavLayout());

    expect(result.current.bottomMenuItems.some((item) => item.key === 'image')).toBe(false);
  });

  it('places the resource entry in the top navigation after home', () => {
    const { result } = renderHook(() => useNavLayout());

    expect(result.current.topNavItems.map((item) => item.key)).toEqual([
      'search',
      'home',
      'resource',
      'pages',
    ]);
    expect(result.current.bottomMenuItems.some((item) => item.key === 'resource')).toBe(false);
  });
});
