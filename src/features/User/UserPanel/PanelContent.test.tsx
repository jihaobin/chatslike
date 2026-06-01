import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ServerConfigStore from '@/store/serverConfig';

import PanelContent from './PanelContent';

const state = vi.hoisted(() => ({
  serverConfig: {
    commercial: {
      commercial: {
        enabled: false,
      },
      lobeHubCloudIntegration: {
        enabled: false,
      },
      nativeBilling: {
        enabled: false,
      },
      platformHostedModels: {
        enabled: false,
      },
    },
  },
  user: {
    logout: vi.fn(),
    openLogin: vi.fn(),
  },
}));

vi.mock('@lobehub/ui', () => ({
  Flexbox: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/business/client/features/User/BusinessPanelContent', () => ({
  default: () => <div data-testid="business-panel-content" />,
}));

vi.mock('@/components/Menu', () => ({
  default: () => <div data-testid="menu" />,
}));

vi.mock('@/const/version', () => ({
  isDesktop: false,
}));

vi.mock('@/features/User/UserInfo', () => ({
  default: () => <div data-testid="user-info" />,
}));

vi.mock('@/routes/(desktop)/desktop-onboarding/navigation', () => ({
  navigateToDesktopOnboarding: vi.fn(),
}));

vi.mock('@/routes/(desktop)/desktop-onboarding/types', () => ({
  DesktopOnboardingScreen: {
    Login: 'login',
  },
}));

vi.mock('@/store/serverConfig', async (importOriginal) => {
  const actual = await importOriginal<typeof ServerConfigStore>();

  return {
    serverConfigSelectors: actual.serverConfigSelectors,
    useServerConfigStore: <T,>(selector: (s: typeof state) => T) => selector(state),
  };
});

vi.mock('@/store/user', () => ({
  useUserStore: <T,>(selector: (s: typeof state.user) => T) => selector(state.user),
}));

vi.mock('@/store/user/selectors', () => ({
  authSelectors: {
    isLoginWithAuth: () => true,
  },
}));

vi.mock('../DataStatistics', () => ({
  default: () => <div data-testid="data-statistics" />,
}));

vi.mock('../UserLoginOrSignup', () => ({
  default: () => <div data-testid="user-login-or-signup" />,
}));

vi.mock('./LangButton', () => ({
  default: () => <div data-testid="lang-button" />,
}));

vi.mock('./useMenu', () => ({
  useMenu: () => ({
    logoutItems: [],
    mainItems: [],
  }),
}));

const renderPanelContent = () =>
  render(
    <MemoryRouter>
      <PanelContent closePopover={vi.fn()} />
    </MemoryRouter>,
  );

describe('PanelContent', () => {
  beforeEach(() => {
    state.serverConfig.commercial.commercial.enabled = false;
    state.serverConfig.commercial.nativeBilling.enabled = false;
  });

  it('renders business panel content when commercial is enabled without native billing', () => {
    state.serverConfig.commercial.commercial.enabled = true;
    state.serverConfig.commercial.nativeBilling.enabled = false;

    renderPanelContent();

    expect(screen.getByTestId('business-panel-content')).toBeInTheDocument();
  });

  it('renders business panel content when native billing is enabled without commercial enabled', () => {
    state.serverConfig.commercial.commercial.enabled = false;
    state.serverConfig.commercial.nativeBilling.enabled = true;

    renderPanelContent();

    expect(screen.getByTestId('business-panel-content')).toBeInTheDocument();
  });

  it('does not render business panel content when commercial and native billing are disabled', () => {
    state.serverConfig.commercial.commercial.enabled = false;
    state.serverConfig.commercial.nativeBilling.enabled = false;

    renderPanelContent();

    expect(screen.queryByTestId('business-panel-content')).not.toBeInTheDocument();
  });
});
