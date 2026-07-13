/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Nav from './Nav';

const navigateMock = vi.hoisted(() => vi.fn());
const setHomeChatModeMock = vi.hoisted(() => vi.fn());
const setChatStateMock = vi.hoisted(() => vi.fn());

const serverConfigState = vi.hoisted(() => ({
  featureFlags: {
    hideAgentManagement: false,
  },
}));

vi.mock('@lobehub/ui', () => ({
  Flexbox: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Icon: () => <span />,
  Tag: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
}));

vi.mock('lucide-react', () => ({
  ChevronDownIcon: () => null,
  ChevronRightIcon: () => null,
  HomeIcon: () => null,
  LayoutGridIcon: () => null,
  SearchIcon: () => null,
  SquarePenIcon: () => null,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('react-router-dom', () => ({
  Link: ({
    children,
    onClick,
    to,
  }: {
    children: ReactNode;
    onClick?: (e: { preventDefault: () => void }) => void;
    to: string;
  }) => (
    <a
      href={to}
      onClick={(e) => {
        onClick?.(e);
      }}
    >
      {children}
    </a>
  ),
  useNavigate: () => navigateMock,
}));

vi.mock('@/features/NavPanel/components/NavItem', () => ({
  default: ({ onClick, title }: { onClick?: () => void; title: ReactNode }) => (
    <button type="button" onClick={onClick}>
      {title}
    </button>
  ),
}));

vi.mock('@/hooks/useActiveTabKey', () => ({
  useActiveTabKey: () => 'home',
}));

vi.mock('@/hooks/useNavLayout', () => ({
  useNavLayout: () => ({
    topNavItems: [
      { key: 'search', title: 'tab.search' },
      { key: 'home', title: 'tab.home', url: '/home' },
      { key: 'resource', title: 'tab.resource', url: '/resource' },
      { key: 'pages', title: 'tab.pages', url: '/page' },
    ],
  }),
}));

vi.mock('@/store/chat', () => ({
  useChatStore: {
    setState: setChatStateMock,
  },
}));

vi.mock('@/store/home', () => ({
  useHomeStore: (
    selector: (state: { setHomeChatMode: (mode: 'welcome' | 'chat') => void }) => unknown,
  ) => selector({ setHomeChatMode: setHomeChatModeMock }),
}));

vi.mock('@/store/serverConfig', () => ({
  useServerConfigStore: (selector: (state: typeof serverConfigState) => unknown) =>
    selector(serverConfigState),
}));

vi.mock('@/store/serverConfig/selectors', () => ({
  featureFlagsSelectors: (state: typeof serverConfigState) => state.featureFlags,
}));

vi.mock('@/utils/navigation', () => ({
  isModifierClick: () => false,
}));

describe('Home sidebar header nav', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    setChatStateMock.mockReset();
    setHomeChatModeMock.mockReset();
    serverConfigState.featureFlags.hideAgentManagement = false;
  });

  it('does not render the new chat action when agent management is visible', () => {
    render(<Nav />);

    expect(
      screen.queryByRole('button', { name: 'management.actions.newChat' }),
    ).not.toBeInTheDocument();
  });

  it('starts a fresh /home chat when agent management is hidden', () => {
    serverConfigState.featureFlags.hideAgentManagement = true;

    render(<Nav />);

    fireEvent.click(screen.getByRole('button', { name: 'management.actions.newChat' }));

    expect(setHomeChatModeMock).toHaveBeenCalledWith('welcome');
    expect(setChatStateMock).toHaveBeenCalledWith(
      { activeThreadId: undefined, activeTopicId: undefined },
      false,
      'HomeNav/newChat',
    );
    expect(navigateMock).toHaveBeenCalledWith('/home');
  });

  it('renders resource and pages under more without home or search text entries', () => {
    render(<Nav />);

    expect(screen.queryByRole('button', { name: 'tab.home' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'tab.search' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'tab.resource' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'more' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'tab.pages' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'more' }));

    expect(screen.getByRole('button', { name: 'collapse' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'tab.pages' })).toBeInTheDocument();
  });

  it('opens resource and pages inside the home workspace routes', () => {
    render(<Nav />);

    fireEvent.click(screen.getByRole('button', { name: 'tab.resource' }));

    expect(navigateMock).toHaveBeenCalledWith('/home/resource');

    fireEvent.click(screen.getByRole('button', { name: 'more' }));
    fireEvent.click(screen.getByRole('button', { name: 'tab.pages' }));

    expect(navigateMock).toHaveBeenCalledWith('/home/page');
    expect(navigateMock).not.toHaveBeenCalledWith('/resource');
    expect(navigateMock).not.toHaveBeenCalledWith('/page');
  });
});
