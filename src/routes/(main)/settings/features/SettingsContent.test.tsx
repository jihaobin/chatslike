import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CommercialRuntimeConfig } from '@/business/shared/commercialRuntime';
import { DEFAULT_FEATURE_FLAGS, mapFeatureFlagsEnvToState } from '@/config/featureFlags';
import { SettingsTabs } from '@/store/global/initialState';
import { initServerConfigStore, Provider } from '@/store/serverConfig/store';
import { useUserStore } from '@/store/user';

import SettingsContent from './SettingsContent';

vi.mock('@/features/NavHeader', () => ({
  default: () => <div data-testid="nav-header" />,
}));

vi.mock('@/features/Setting/SettingContainer', () => ({
  default: ({ children }: { children: ReactNode }) => (
    <div data-testid="setting-container">{children}</div>
  ),
}));

vi.mock('./componentMap', () => {
  const createComponent =
    (name: string) =>
    ({ mobile }: { mobile?: boolean }) => (
      <div data-mobile={String(Boolean(mobile))} data-testid={`settings-${name}`} />
    );

  return {
    componentMap: {
      [SettingsTabs.AdminBilling]: createComponent(SettingsTabs.AdminBilling),
      [SettingsTabs.APIKey]: createComponent(SettingsTabs.APIKey),
      [SettingsTabs.Appearance]: createComponent(SettingsTabs.Appearance),
      [SettingsTabs.About]: createComponent(SettingsTabs.About),
      [SettingsTabs.Billing]: createComponent(SettingsTabs.Billing),
      [SettingsTabs.Credits]: createComponent(SettingsTabs.Credits),
      [SettingsTabs.Notification]: createComponent(SettingsTabs.Notification),
      [SettingsTabs.Plans]: createComponent(SettingsTabs.Plans),
      [SettingsTabs.Profile]: createComponent(SettingsTabs.Profile),
      [SettingsTabs.Provider]: createComponent(SettingsTabs.Provider),
      [SettingsTabs.Proxy]: createComponent(SettingsTabs.Proxy),
      [SettingsTabs.Referral]: createComponent(SettingsTabs.Referral),
      [SettingsTabs.SystemTools]: createComponent(SettingsTabs.SystemTools),
      [SettingsTabs.Usage]: createComponent(SettingsTabs.Usage),
    },
  };
});

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

const renderSettingsContent = ({
  activeTab,
  commercial = createCommercialConfig(),
  featureFlags = {},
  mobile = true,
}: {
  activeTab: SettingsTabs;
  commercial?: CommercialRuntimeConfig;
  featureFlags?: Partial<{
    hideDocs: boolean;
    showApiKeyManage: boolean;
    showProvider: boolean;
  }>;
  mobile?: boolean;
}) =>
  render(
    <Provider
      createStore={() =>
        initServerConfigStore({
          featureFlags: {
            ...mapFeatureFlagsEnvToState(DEFAULT_FEATURE_FLAGS),
            ...featureFlags,
          },
          serverConfig: {
            aiProvider: {},
            commercial,
            telemetry: {},
          },
        })
      }
    >
      <MemoryRouter>
        <SettingsContent activeTab={activeTab} mobile={mobile} />
      </MemoryRouter>
    </Provider>,
  );

const initialUserStoreState = useUserStore.getState();

afterEach(() => {
  useUserStore.setState(initialUserStoreState, true);
});

describe('SettingsContent', () => {
  it('does not render native billing tabs from direct navigation when native billing is disabled', () => {
    renderSettingsContent({ activeTab: SettingsTabs.Plans });

    expect(screen.queryByTestId(`settings-${SettingsTabs.Plans}`)).not.toBeInTheDocument();
  });

  it('renders native billing tabs and preserves mobile prop when native billing is enabled', () => {
    renderSettingsContent({
      activeTab: SettingsTabs.Plans,
      commercial: createCommercialConfig({ nativeBilling: true }),
    });

    expect(screen.getByTestId(`settings-${SettingsTabs.Plans}`)).toHaveAttribute(
      'data-mobile',
      'true',
    );
  });

  it('requires native billing and super-admin for direct Admin Billing access', () => {
    const commercial = createCommercialConfig({ nativeBilling: true });

    const { unmount } = renderSettingsContent({ activeTab: SettingsTabs.AdminBilling, commercial });

    expect(screen.queryByTestId(`settings-${SettingsTabs.AdminBilling}`)).not.toBeInTheDocument();
    unmount();

    act(() => {
      useUserStore.setState({ user: { id: 'super-admin-user', role: 'super-admin' } }, false);
    });

    renderSettingsContent({ activeTab: SettingsTabs.AdminBilling, commercial });

    expect(screen.getByTestId(`settings-${SettingsTabs.AdminBilling}`)).toHaveAttribute(
      'data-mobile',
      'true',
    );
  });

  it('does not render Referral from direct navigation without cloud integration', () => {
    renderSettingsContent({
      activeTab: SettingsTabs.Referral,
      commercial: createCommercialConfig({ nativeBilling: true }),
    });

    expect(screen.queryByTestId(`settings-${SettingsTabs.Referral}`)).not.toBeInTheDocument();
  });

  it('renders Referral and Notification through cloud integration', () => {
    const commercial = createCommercialConfig({ lobeHubCloudIntegration: true });

    renderSettingsContent({ activeTab: SettingsTabs.Referral, commercial });
    expect(screen.getByTestId(`settings-${SettingsTabs.Referral}`)).toHaveAttribute(
      'data-mobile',
      'true',
    );

    renderSettingsContent({ activeTab: SettingsTabs.Notification, commercial });
    expect(screen.getByTestId(`settings-${SettingsTabs.Notification}`)).toHaveAttribute(
      'data-mobile',
      'true',
    );
  });

  it('preserves ungated tab rendering', () => {
    renderSettingsContent({ activeTab: SettingsTabs.Profile });

    expect(screen.getByTestId(`settings-${SettingsTabs.Profile}`)).toHaveAttribute(
      'data-mobile',
      'true',
    );
  });

  it('does not render Provider from direct navigation when provider settings are hidden', () => {
    renderSettingsContent({
      activeTab: SettingsTabs.Provider,
      featureFlags: { showProvider: false },
    });

    expect(screen.queryByTestId(`settings-${SettingsTabs.Provider}`)).not.toBeInTheDocument();
  });

  it('does not render Provider from direct navigation for ordinary platform-model-only users', () => {
    renderSettingsContent({
      activeTab: SettingsTabs.Provider,
      commercial: createCommercialConfig({ platformHostedModels: true }),
    });

    expect(screen.queryByTestId(`settings-${SettingsTabs.Provider}`)).not.toBeInTheDocument();
  });

  it('renders Provider from direct navigation for super-admin platform-model settings', () => {
    act(() => {
      useUserStore.setState({ user: { id: 'super-admin-user', role: 'super-admin' } }, false);
    });

    renderSettingsContent({
      activeTab: SettingsTabs.Provider,
      commercial: createCommercialConfig({ platformHostedModels: true }),
    });

    expect(screen.getByTestId(`settings-${SettingsTabs.Provider}`)).toHaveAttribute(
      'data-mobile',
      'true',
    );
  });

  it('gates APIKey by API key management flag or dev mode', () => {
    const { unmount } = renderSettingsContent({
      activeTab: SettingsTabs.APIKey,
      featureFlags: { showApiKeyManage: false },
    });

    expect(screen.queryByTestId(`settings-${SettingsTabs.APIKey}`)).not.toBeInTheDocument();
    unmount();

    renderSettingsContent({
      activeTab: SettingsTabs.APIKey,
      featureFlags: { showApiKeyManage: true },
    });

    expect(screen.getByTestId(`settings-${SettingsTabs.APIKey}`)).toHaveAttribute(
      'data-mobile',
      'true',
    );
  });

  it('allows APIKey from direct navigation in dev mode', () => {
    useUserStore.setState({ settings: { general: { isDevMode: true } } }, false);

    renderSettingsContent({
      activeTab: SettingsTabs.APIKey,
      featureFlags: { showApiKeyManage: false },
    });

    expect(screen.getByTestId(`settings-${SettingsTabs.APIKey}`)).toHaveAttribute(
      'data-mobile',
      'true',
    );
  });

  it('does not render About from direct navigation when docs are hidden', () => {
    renderSettingsContent({
      activeTab: SettingsTabs.About,
      featureFlags: { hideDocs: true },
    });

    expect(screen.queryByTestId(`settings-${SettingsTabs.About}`)).not.toBeInTheDocument();
  });

  it('does not render desktop-only system tabs from direct navigation in web builds', () => {
    renderSettingsContent({ activeTab: SettingsTabs.Proxy });
    expect(screen.queryByTestId(`settings-${SettingsTabs.Proxy}`)).not.toBeInTheDocument();

    renderSettingsContent({ activeTab: SettingsTabs.SystemTools });
    expect(screen.queryByTestId(`settings-${SettingsTabs.SystemTools}`)).not.toBeInTheDocument();
  });
});
