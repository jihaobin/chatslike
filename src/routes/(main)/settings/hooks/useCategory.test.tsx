import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CommercialRuntimeConfig } from '@/business/shared/commercialRuntime';
import { mapFeatureFlagsEnvToState } from '@/config/featureFlags';
import { SettingsTabs } from '@/store/global/initialState';
import { initServerConfigStore, Provider } from '@/store/serverConfig/store';
import { useUserStore } from '@/store/user';

import { useCategory } from './useCategory';

vi.hoisted(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: vi.fn(() => null),
      removeItem: vi.fn(),
      setItem: vi.fn(),
    },
  });
});

vi.mock('@lobehub/ui', () => ({
  Avatar: () => <div data-testid="avatar" />,
}));

vi.mock('@lobehub/ui/icons', () => ({
  SkillsIcon: () => <svg data-testid="skills-icon" />,
}));

vi.mock('lucide-react', () => {
  const Icon = () => <svg data-testid="icon" />;

  return {
    BellIcon: Icon,
    Brain: Icon,
    BrainCircuit: Icon,
    ChartColumnBigIcon: Icon,
    Circle: Icon,
    Coins: Icon,
    CreditCard: Icon,
    Database: Icon,
    EllipsisIcon: Icon,
    EthernetPort: Icon,
    Gift: Icon,
    Info: Icon,
    KeyboardIcon: Icon,
    KeyIcon: Icon,
    KeyRound: Icon,
    Map: Icon,
    MessageCircleIcon: Icon,
    PaletteIcon: Icon,
    Sparkles: Icon,
    TerminalSquare: Icon,
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const createCommercialConfig = (
  overrides?: Partial<{
    lobeHubCloudIntegration: boolean;
    nativeBilling: boolean;
    platformHostedModels: boolean;
  }>,
): CommercialRuntimeConfig => ({
  commercial: {
    enabled: Boolean(
      overrides?.lobeHubCloudIntegration ||
      overrides?.nativeBilling ||
      overrides?.platformHostedModels,
    ),
  },
  lobeHubCloudIntegration: { enabled: overrides?.lobeHubCloudIntegration ?? false },
  nativeBilling: { enabled: overrides?.nativeBilling ?? false },
  platformHostedModels: { enabled: overrides?.platformHostedModels ?? false },
});

const createWrapper = (
  showProvider: boolean,
  commercial: CommercialRuntimeConfig = createCommercialConfig(),
) => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <Provider
      createStore={() =>
        initServerConfigStore({
          featureFlags: {
            ...mapFeatureFlagsEnvToState({
              provider_settings: true,
            }),
            showProvider,
          },
          serverConfig: {
            aiProvider: {},
            commercial,
            enableBusinessFeatures: true,
            telemetry: {},
          },
        })
      }
    >
      {children}
    </Provider>
  );

  return Wrapper;
};

const getItemKeys = (commercial?: CommercialRuntimeConfig) => {
  const { result } = renderHook(() => useCategory(), {
    wrapper: createWrapper(true, commercial),
  });

  return result.current.flatMap((group) => group.items.map((item) => item.key));
};

const getProviderItem = (commercial?: CommercialRuntimeConfig) => {
  const { result } = renderHook(() => useCategory(), {
    wrapper: createWrapper(true, commercial),
  });

  return result.current
    .flatMap((group) => group.items)
    .find((item) => item.key === SettingsTabs.Provider);
};

const initialUserStoreState = useUserStore.getState();

afterEach(() => {
  useUserStore.setState(initialUserStoreState, true);
});

describe('settings useCategory', () => {
  it('keeps Provider visible when provider settings are enabled', () => {
    expect(getItemKeys()).toContain(SettingsTabs.Provider);
  });

  it('hides Provider when provider settings are disabled', () => {
    const { result } = renderHook(() => useCategory(), {
      wrapper: createWrapper(false),
    });

    const keys = result.current.flatMap((group) => group.items.map((item) => item.key));

    expect(keys).not.toContain(SettingsTabs.Provider);
  });

  it('hides Provider for ordinary platform-model-only users', () => {
    act(() => {
      useUserStore.setState({ user: { id: 'normal-user', role: 'user' } }, false);
    });

    expect(getItemKeys(createCommercialConfig({ platformHostedModels: true }))).not.toContain(
      SettingsTabs.Provider,
    );
  });

  it('keeps Provider visible for super-admin platform-model settings', () => {
    act(() => {
      useUserStore.setState({ user: { id: 'super-admin-user', role: 'super-admin' } }, false);
    });

    expect(getProviderItem(createCommercialConfig({ platformHostedModels: true }))).toMatchObject({
      key: SettingsTabs.Provider,
      url: '/settings/provider/global/all',
    });
  });

  it('routes super-admin provider settings to global scope when user provider settings are available', () => {
    act(() => {
      useUserStore.setState({ user: { id: 'super-admin-user', role: 'super-admin' } }, false);
    });

    expect(getProviderItem()).toMatchObject({
      key: SettingsTabs.Provider,
      url: '/settings/provider/global/all',
    });
  });

  it('shows native billing tabs when native billing is enabled', () => {
    const keys = getItemKeys(createCommercialConfig({ nativeBilling: true }));

    expect(keys).toEqual(
      expect.arrayContaining([
        SettingsTabs.Plans,
        SettingsTabs.Usage,
        SettingsTabs.Credits,
        SettingsTabs.Billing,
      ]),
    );
  });

  it('hides native billing tabs when native billing is disabled', () => {
    const keys = getItemKeys(createCommercialConfig({ lobeHubCloudIntegration: true }));

    expect(keys).not.toContain(SettingsTabs.Plans);
    expect(keys).not.toContain(SettingsTabs.Usage);
    expect(keys).not.toContain(SettingsTabs.Credits);
    expect(keys).not.toContain(SettingsTabs.Billing);
  });

  it('shows Referral only for the official cloud integration while native referral is unavailable', () => {
    expect(getItemKeys(createCommercialConfig({ nativeBilling: true }))).not.toContain(
      SettingsTabs.Referral,
    );

    expect(getItemKeys(createCommercialConfig({ lobeHubCloudIntegration: true }))).toContain(
      SettingsTabs.Referral,
    );
  });
});
