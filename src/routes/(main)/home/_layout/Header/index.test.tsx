import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import Header from './index';

interface MockAgentState {
  activeAgentId: string;
  agentMap: Record<string, { model: string; provider: string }>;
}

vi.mock('@lobehub/icons', () => ({
  ModelIcon: ({ model, size }: { model: string; size: number }) => (
    <span data-model={model} data-size={size} data-testid="home-model-icon" />
  ),
  ProviderIcon: () => <span data-testid="home-provider-icon" />,
}));

vi.mock('@/features/NavPanel/SideBarHeaderLayout', () => ({
  default: ({ left, right }: { left?: ReactNode; right?: ReactNode }) => (
    <div>
      <div data-testid="sidebar-header-left">{left}</div>
      <div>{right}</div>
    </div>
  ),
}));

vi.mock('@/features/NavPanel/ToggleLeftPanelButton', () => ({
  default: () => <button type="button">Toggle panel</button>,
}));

vi.mock('@/store/agent', () => ({
  useAgentStore: (selector: (state: MockAgentState) => unknown) =>
    selector({
      activeAgentId: 'agent1',
      agentMap: {
        agent1: {
          model: 'claude-sonnet-4',
          provider: 'anthropic',
        },
      },
    }),
}));

vi.mock('@/store/agent/selectors', () => ({
  agentSelectors: {
    currentAgentModel: (state: MockAgentState) => state.agentMap[state.activeAgentId]?.model,
    currentAgentModelProvider: (state: MockAgentState) =>
      state.agentMap[state.activeAgentId]?.provider || 'openai',
  },
}));

vi.mock('./components/InboxButton', () => ({
  default: () => <button type="button">Inbox</button>,
}));

vi.mock('./components/Nav', () => ({
  default: () => <nav>Navigation</nav>,
}));

vi.mock('./components/SearchButton', () => ({
  default: () => <button type="button">Search</button>,
}));

describe('Home sidebar Header', () => {
  it('renders the selected model family icon in the top-left slot', () => {
    render(<Header />);

    const icon = screen.getByTestId('home-model-icon');

    expect(icon).toHaveAttribute('data-model', 'claude-sonnet-4');
    expect(icon).toHaveAttribute('data-size', '24');
    expect(screen.getByTestId('sidebar-header-left')).toContainElement(icon);
  });
});
