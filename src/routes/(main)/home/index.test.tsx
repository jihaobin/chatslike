import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Home from './index';

const serverConfigState = vi.hoisted(() => ({
  featureFlags: {
    hideAgentManagement: false,
  },
}));

const homeState = vi.hoisted(() => ({
  homeChatMode: 'welcome' as 'welcome' | 'chat',
}));

vi.mock('@lobehub/ui', () => ({
  Block: ({
    children,
    className,
    ...rest
  }: {
    children: ReactNode;
    className?: string;
  }) => (
    <span className={className} {...rest}>
      {children}
    </span>
  ),
  Flexbox: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Icon: ({ id, size }: { id?: string; size?: number }) => (
    <span data-size={size} data-testid="home-settings-icon" id={id} />
  ),
}));

vi.mock('antd-style', () => ({
  createStaticStyles: (
    factory: (utils: {
      css: (strings: TemplateStringsArray, ...values: unknown[]) => string;
      cssVar: Record<string, string>;
    }) => Record<string, string>,
  ) =>
    factory({
      css: (strings, ...values) =>
        strings.reduce((result, part, index) => `${result}${part}${values[index] || ''}`, ''),
      cssVar: {
        colorFillSecondary: '#f0f0f0',
        colorTextSecondary: '#666',
      },
    }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/components/Analytics/HomePageTracker', () => ({
  default: () => null,
}));

vi.mock('@/features/NavHeader', () => ({
  default: ({ left, right }: { left?: ReactNode; right?: ReactNode }) => (
    <header>
      <div data-testid="home-nav-left">{left}</div>
      <div data-testid="home-nav-right">{right}</div>
    </header>
  ),
}));

vi.mock('@/features/WideScreenContainer', () => ({
  default: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

vi.mock('@/features/Home/InboxChatWorkspace', () => ({
  default: () => <div>Inbox chat workspace</div>,
}));

vi.mock('@/store/home', () => ({
  useHomeStore: (selector: (state: typeof homeState) => unknown) => selector(homeState),
}));

vi.mock('@/store/serverConfig', () => ({
  useServerConfigStore: (selector: (state: typeof serverConfigState) => unknown) =>
    selector(serverConfigState),
}));

vi.mock('@/store/serverConfig/selectors', () => ({
  featureFlagsSelectors: (state: typeof serverConfigState) => state.featureFlags,
}));

vi.mock('./features', () => ({
  default: () => <div>Home content</div>,
}));

vi.mock('./features/HomeModelSelector', () => ({
  default: () => <div>Model selector</div>,
}));

vi.mock('./_layout/Header/components/User', () => ({
  default: () => <button type="button">User trigger</button>,
}));

describe('Home page header actions', () => {
  beforeEach(() => {
    serverConfigState.featureFlags.hideAgentManagement = false;
    homeState.homeChatMode = 'welcome';
  });

  it('renders settings as an icon-only action next to the user trigger', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    const rightSlot = screen.getByTestId('home-nav-right');
    const settingsLink = within(rightSlot).getByRole('link', { name: 'tab.setting' });

    expect(settingsLink).toHaveAttribute('href', '/settings');
    expect(within(settingsLink).getByTestId('home-settings-icon')).toBeInTheDocument();
    expect(within(rightSlot).getByText('User trigger')).toBeInTheDocument();
    expect(within(rightSlot).queryByText('tab.setting')).not.toBeInTheDocument();
  });

  it('keeps the welcome content on plain /home when agent management is hidden', () => {
    serverConfigState.featureFlags.hideAgentManagement = true;

    render(
      <MemoryRouter initialEntries={['/home']}>
        <Home />
      </MemoryRouter>,
    );

    expect(screen.getByText('Home content')).toBeInTheDocument();
    expect(screen.queryByText('Inbox chat workspace')).not.toBeInTheDocument();
  });

  it('renders inbox chat workspace on /home?topic=... when agent management is hidden', () => {
    serverConfigState.featureFlags.hideAgentManagement = true;

    render(
      <MemoryRouter initialEntries={['/home?topic=tpc_123']}>
        <Home />
      </MemoryRouter>,
    );

    expect(screen.getByText('Inbox chat workspace')).toBeInTheDocument();
    expect(screen.queryByText('Home content')).not.toBeInTheDocument();
  });

  it('renders inbox chat workspace after home send activates chat mode', () => {
    serverConfigState.featureFlags.hideAgentManagement = true;
    homeState.homeChatMode = 'chat';

    render(
      <MemoryRouter initialEntries={['/home']}>
        <Home />
      </MemoryRouter>,
    );

    expect(screen.getByText('Inbox chat workspace')).toBeInTheDocument();
  });
});
