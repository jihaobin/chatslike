import { renderHook } from '@testing-library/react';
import { type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

const createWrapper = (showProvider: boolean) => {
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

const getItemKeys = () => {
  const { result } = renderHook(() => useCategory(), {
    wrapper: createWrapper(true),
  });

  return result.current.flatMap((group) => group.items.map((item) => item.key));
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

  it('shows Admin Billing only for super-admin users', () => {
    useUserStore.setState({ user: { id: 'admin-user', role: 'admin' } });

    expect(getItemKeys()).not.toContain(SettingsTabs.AdminBilling);

    useUserStore.setState({ user: { id: 'super-admin-user', role: 'super-admin' } }, false);

    expect(getItemKeys()).toContain(SettingsTabs.AdminBilling);

    useUserStore.setState({ user: { id: 'normal-user' } }, false);

    expect(getItemKeys()).not.toContain(SettingsTabs.AdminBilling);
  });
});
