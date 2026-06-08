import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import HomeContent from './index';

vi.mock('@/features/DailyBrief', () => ({
  default: () => <div data-testid="daily-brief" />,
}));

vi.mock('@/store/user', () => ({
  useUserStore: () => false,
}));

vi.mock('@/store/user/slices/auth/selectors', () => ({
  authSelectors: {
    isLogin: vi.fn(),
  },
}));

vi.mock('./AgentSelect', () => ({
  default: () => <div data-testid="agent-select" />,
}));

vi.mock('./InputArea', () => ({
  default: () => <div data-testid="input-area" />,
}));

vi.mock('./WelcomeText', () => ({
  default: () => <div data-testid="welcome-text" />,
}));

describe('HomeContent', () => {
  it('keeps the main content free of the model selector', () => {
    render(<HomeContent />);

    expect(screen.queryByTestId('home-model-selector')).not.toBeInTheDocument();
    expect(screen.getByTestId('agent-select')).toBeInTheDocument();
    expect(screen.getByTestId('input-area')).toBeInTheDocument();
  });
});
