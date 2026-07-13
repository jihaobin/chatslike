/**
 * @vitest-environment happy-dom
 */
import { render, screen } from '@testing-library/react';
import dayjs from 'dayjs';
import type { CSSProperties } from 'react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import RecentsList from './List';

const homeState = vi.hoisted(() => ({
  hasMoreRecents: false,
  isRecentsInit: true,
  loadMoreRecents: vi.fn(),
  recentListLimit: 20,
  recents: [
    {
      agentId: 'agt_inbox',
      icon: 'topic',
      id: 'tpc_123',
      routePath: '/home/agent/agt_inbox/tpc_123',
      title: 'Inbox topic',
      type: 'topic' as const,
      updatedAt: new Date('2026-07-07T00:00:00.000Z'),
    },
    {
      agentId: 'agt_inbox',
      icon: 'topic',
      id: 'tpc_older',
      routePath: '/home/agent/agt_inbox/tpc_older',
      title: 'Older topic',
      type: 'topic' as const,
      updatedAt: new Date('2026-06-01T00:00:00.000Z'),
    },
  ],
}));

const globalState = vi.hoisted(() => ({
  status: {
    recentPageSize: 1,
  },
}));

const serverConfigState = vi.hoisted(() => ({
  featureFlags: {
    hideAgentManagement: false,
  },
}));

vi.mock('@lobehub/ui', () => ({
  Flexbox: ({
    children,
    className,
    style,
    ...rest
  }: {
    children: ReactNode;
    className?: string;
    style?: CSSProperties;
  } & Record<string, unknown>) => (
    <div className={className} style={style} {...rest}>
      {children}
    </div>
  ),
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/features/NavPanel/components/NavItem', () => ({
  default: ({ title }: { title: string }) => <span>{title}</span>,
}));

vi.mock('@/features/NavPanel/components/SkeletonList', () => ({
  default: () => <div>loading</div>,
}));

vi.mock('@/store/global', () => ({
  useGlobalStore: (selector: (state: typeof globalState) => unknown) => selector(globalState),
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

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        'navPanel.recents.thirtyDays': '30 days',
        'navPanel.recents.week': '7 days',
        'time.today': 'Today',
        'time.yesterday': 'Yesterday',
      };
      return labels[key] ?? key;
    },
  }),
}));

vi.mock('./Item', () => ({
  default: ({ title }: { title: string }) => <span>{title}</span>,
}));

describe('RecentsList', () => {
  beforeEach(() => {
    serverConfigState.featureFlags.hideAgentManagement = false;
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-07T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps existing recent topic route when agent management is visible', () => {
    render(
      <MemoryRouter>
        <RecentsList />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Inbox topic' })).toHaveAttribute(
      'href',
      '/home/agent/agt_inbox/tpc_123',
    );
  });

  it('rewrites recent topic route to /home query when agent management is hidden', () => {
    serverConfigState.featureFlags.hideAgentManagement = true;

    render(
      <MemoryRouter>
        <RecentsList />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Inbox topic' })).toHaveAttribute(
      'href',
      '/home?topic=tpc_123',
    );
  });

  it('renders grouped recents without the more drawer entry', () => {
    render(
      <MemoryRouter>
        <RecentsList />
      </MemoryRouter>,
    );

    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText(dayjs('2026-06-01').format('YYYY-MM'))).toBeInTheDocument();
    expect(screen.getByText('Older topic')).toBeInTheDocument();
    expect(screen.queryByText('input.more')).not.toBeInTheDocument();
  });

  it('allows the recent history list to fill the available sidebar height', () => {
    render(
      <MemoryRouter>
        <RecentsList />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('home-recents-list')).toHaveStyle({
      height: '100%',
    });
  });
});
