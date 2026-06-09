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
  it('renders a ChatGPT-like centered welcome above the input', () => {
    render(<HomeContent />);

    const hero = screen.getByTestId('home-welcome-hero');

    expect(screen.queryByTestId('home-model-selector')).not.toBeInTheDocument();
    expect(screen.queryByTestId('agent-select')).not.toBeInTheDocument();
    expect(hero).toContainElement(screen.getByTestId('welcome-text'));
    expect(screen.getByTestId('input-area')).toBeInTheDocument();
  });
});
