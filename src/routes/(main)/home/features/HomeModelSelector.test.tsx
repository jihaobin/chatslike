import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import HomeModelSelector from './HomeModelSelector';

vi.mock('@/features/ModelSwitchPanel', () => ({
  default: ({ children, placement }: { children: React.ReactNode; placement: string }) => (
    <div data-placement={placement} data-testid="home-model-switch-panel">
      {children}
    </div>
  ),
}));

vi.mock('@/hooks/useInitAgentConfig', () => ({
  useInitAgentConfig: vi.fn(),
}));

vi.mock('@/store/agent', () => ({
  useAgentStore: (selector: any) =>
    selector({
      agentMap: {
        agent1: {
          chatConfig: {
            model: 'deepseek-v4-pro',
            provider: 'deepseek',
          },
        },
      },
      updateAgentConfigById: vi.fn(),
    }),
}));

vi.mock('@/store/agent/selectors', () => ({
  agentByIdSelectors: {
    getAgentModelById: () => () => 'deepseek-v4-pro',
    getAgentModelProviderById: () => () => 'deepseek',
  },
}));

vi.mock('@/store/aiInfra', () => ({
  aiModelSelectors: {
    getEnabledModelById: () => () => ({ displayName: 'DeepSeek V4 Pro' }),
  },
  useAiInfraStore: (selector: any) => selector({}),
}));

vi.mock('./AgentSelect/useResolvedHomeAgentId', () => ({
  useResolvedHomeAgentId: () => ({ agentId: 'agent1' }),
}));

describe('HomeModelSelector', () => {
  it('renders the current home model as a top-left switch trigger', () => {
    render(<HomeModelSelector />);

    expect(screen.getByTestId('home-model-switch-panel')).toHaveAttribute(
      'data-placement',
      'bottomLeft',
    );
    expect(screen.getByRole('button', { name: 'DeepSeek V4 Pro' })).toBeInTheDocument();
  });
});
