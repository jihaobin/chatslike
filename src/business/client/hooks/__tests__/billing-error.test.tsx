import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderInsufficientCreditsContent } from '../useBusinessErrorContent';

const navigateMock = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

vi.mock('i18next', () => ({
  t: (key: string) => key,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('@lobehub/ui', () => ({
  Button: ({
    children,
    onClick,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button onClick={onClick} type="button">
      {children}
    </button>
  ),
  Flexbox: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

describe('billing error content', () => {
  it('shows required credits, available credits and deficit', () => {
    render(
      renderInsufficientCreditsContent({
        availableCredits: 10_000,
        deficitCredits: 30_000,
        requiredCredits: 40_000,
      }),
    );

    expect(screen.getByText('limitation.insufficientBudget.title')).toBeInTheDocument();
    expect(screen.getByText('limitation.insufficientBudget.required')).toBeInTheDocument();
    expect(screen.getByText('limitation.insufficientBudget.available')).toBeInTheDocument();
    expect(screen.getByText('limitation.insufficientBudget.shortfall')).toBeInTheDocument();
    expect(screen.getByText('40,000')).toBeInTheDocument();
    expect(screen.getByText('10,000')).toBeInTheDocument();
    expect(screen.getByText('30,000')).toBeInTheDocument();
  });
});
