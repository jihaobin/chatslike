import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CommercialRuntimeConfig } from '@/business/shared/commercialRuntime';
import { DEFAULT_FEATURE_FLAGS, mapFeatureFlagsEnvToState } from '@/config/featureFlags';
import { useAiInfraStore } from '@/store/aiInfra';
import {
  initServerConfigStore,
  Provider as ServerConfigProvider,
} from '@/store/serverConfig/store';
import { useUserStore } from '@/store/user';

import MobileProviderLayout from '../../../../(mobile)/settings/provider/_layout';
import { ProviderGlobalLayout, ProviderLayout } from '..';
import ProviderScopeBanner from '../features/ProviderScopeBanner';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@lobehub/ui', () => ({
  Center: ({ children }: { children: ReactNode }) => <div data-testid="center">{children}</div>,
  Flexbox: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Alert: ({ description, message }: { description: string; message: string }) => (
    <div data-testid="scope-banner">
      <span>{message}</span>
      <span>{description}</span>
    </div>
  ),
}));

vi.mock('../ProviderMenu', () => ({
  default: () => <div data-testid="provider-menu" />,
}));

vi.mock('../_layout/Desktop/Container', () => ({
  default: ({ children }: { children: ReactNode }) => (
    <div data-testid="provider-container">{children}</div>
  ),
}));

vi.mock('../(list)/Footer', () => ({
  default: () => <div data-testid="provider-footer" />,
}));

const createCommercialConfig = (platformHostedModels = false): CommercialRuntimeConfig => ({
  commercial: { enabled: platformHostedModels },
  lobeHubCloudIntegration: { enabled: false },
  nativeBilling: { enabled: false },
  platformHostedModels: { enabled: platformHostedModels },
});

const renderWithServerConfig = (
  children: ReactNode,
  commercial = createCommercialConfig(),
  initialEntries = ['/'],
) =>
  render(
    <ServerConfigProvider
      createStore={() =>
        initServerConfigStore({
          featureFlags: mapFeatureFlagsEnvToState(DEFAULT_FEATURE_FLAGS),
          serverConfig: { aiProvider: {}, commercial, telemetry: {} },
        })
      }
    >
      <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
    </ServerConfigProvider>,
  );

const initialUserStoreState = useUserStore.getState();
const initialAiInfraStoreState = useAiInfraStore.getState();

afterEach(() => {
  act(() => {
    useAiInfraStore.setState(initialAiInfraStoreState, true);
    useUserStore.setState(initialUserStoreState, true);
  });
});

describe('global provider scope settings UI', () => {
  it('shows global scope banner only in global scope', () => {
    const { rerender } = render(<ProviderScopeBanner />);

    expect(screen.queryByTestId('scope-banner')).not.toBeInTheDocument();

    act(() => {
      useAiInfraStore.setState({ activeProviderConfigScope: 'global' });
    });

    rerender(<ProviderScopeBanner />);

    expect(screen.getByTestId('scope-banner')).toHaveTextContent('providerScope.global.title');
  });

  it('does not render provider settings content for ordinary platform-model-only users', () => {
    renderWithServerConfig(<ProviderLayout />, createCommercialConfig(true));

    expect(screen.getByText('providerScope.noAccess.title')).toBeInTheDocument();
    expect(screen.queryByTestId('provider-menu')).not.toBeInTheDocument();
  });

  it('does not render mobile provider settings content for ordinary platform-model-only users', () => {
    renderWithServerConfig(
      <Routes>
        <Route element={<MobileProviderLayout />} path="/settings/provider">
          <Route element={<div data-testid="mobile-provider-detail" />} path=":providerId" />
        </Route>
      </Routes>,
      createCommercialConfig(true),
      ['/settings/provider/all'],
    );

    expect(screen.getByText('providerScope.noAccess.title')).toBeInTheDocument();
    expect(screen.queryByTestId('provider-menu')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mobile-provider-detail')).not.toBeInTheDocument();
  });

  it('sets global scope through the /settings/provider/global route entry', () => {
    act(() => {
      useUserStore.setState({ user: { id: 'super-admin-user', role: 'super-admin' } }, false);
      useAiInfraStore.setState({ activeProviderConfigScope: 'user' });
    });

    renderWithServerConfig(
      <Routes>
        <Route element={<ProviderGlobalLayout />} path="/settings/provider/global">
          <Route element={<div data-testid="global-provider-detail" />} path=":providerId" />
        </Route>
      </Routes>,
      createCommercialConfig(true),
      ['/settings/provider/global/all'],
    );

    expect(screen.getByTestId('provider-menu')).toBeInTheDocument();
    expect(screen.getByTestId('global-provider-detail')).toBeInTheDocument();
    expect(useAiInfraStore.getState().activeProviderConfigScope).toBe('global');
  });

  it('does not render desktop global provider settings content for ordinary users', () => {
    renderWithServerConfig(
      <Routes>
        <Route element={<ProviderGlobalLayout />} path="/settings/provider/global">
          <Route element={<div data-testid="global-provider-detail" />} path=":providerId" />
        </Route>
      </Routes>,
      createCommercialConfig(),
      ['/settings/provider/global/all'],
    );

    expect(screen.getByText('providerScope.noAccess.title')).toBeInTheDocument();
    expect(screen.queryByTestId('provider-menu')).not.toBeInTheDocument();
    expect(screen.queryByTestId('global-provider-detail')).not.toBeInTheDocument();
    expect(useAiInfraStore.getState().activeProviderConfigScope).toBe('user');
  });

  it('does not render mobile global provider settings content for ordinary users', () => {
    renderWithServerConfig(
      <Routes>
        <Route element={<MobileProviderLayout />} path="/settings/provider/global">
          <Route element={<div data-testid="mobile-global-provider-detail" />} path=":providerId" />
        </Route>
      </Routes>,
      createCommercialConfig(),
      ['/settings/provider/global/all'],
    );

    expect(screen.getByText('providerScope.noAccess.title')).toBeInTheDocument();
    expect(screen.queryByTestId('provider-menu')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mobile-global-provider-detail')).not.toBeInTheDocument();
    expect(useAiInfraStore.getState().activeProviderConfigScope).toBe('user');
  });

  it('registers the production global provider route in both desktop router configs', async () => {
    const [asyncSource, syncSource] = await Promise.all([
      readFile(path.join(process.cwd(), 'src/spa/router/desktopRouter.config.tsx'), 'utf8'),
      readFile(path.join(process.cwd(), 'src/spa/router/desktopRouter.config.desktop.tsx'), 'utf8'),
    ]);

    expect(asyncSource).toContain("path: 'global'");
    expect(asyncSource).toContain('ProviderGlobalLayout');
    expect(asyncSource).toContain('ProviderGlobalRedirect');
    expect(syncSource).toContain("path: 'global'");
    expect(syncSource).toContain('<ProviderGlobalLayout />');
    expect(syncSource).toContain('<ProviderGlobalRedirect />');
  });
});
