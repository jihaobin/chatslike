import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  renderInsufficientCreditsContent,
  renderPhoneVerificationRequiredContent,
} from '../useBusinessErrorContent';

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
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  Center: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Flexbox: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => (
    <div onClick={onClick}>{children}</div>
  ),
  FluentEmoji: ({ emoji }: { emoji: string }) => <span>{emoji}</span>,
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

  it('shows chat recovery actions for insufficient credits', () => {
    const onTopUpCredits = vi.fn();
    const onUpgradePlan = vi.fn();
    const onInviteFriends = vi.fn();

    render(
      renderInsufficientCreditsContent(
        {
          availableCredits: 4524,
          deficitCredits: 7296,
          requiredCredits: 11_820,
        },
        { onInviteFriends, onTopUpCredits, onUpgradePlan },
      ),
    );

    expect(screen.getByText('limitation.insufficientBudget.estimatedDesc')).toBeInTheDocument();
    fireEvent.click(screen.getByText('limitation.limited.upgradeToPlan'));
    fireEvent.click(screen.getByText('limitation.limited.topup'));
    fireEvent.click(screen.getByText('limitation.limited.referralTip'));

    expect(onUpgradePlan).toHaveBeenCalledTimes(1);
    expect(onTopUpCredits).toHaveBeenCalledTimes(1);
    expect(onInviteFriends).toHaveBeenCalledTimes(1);
  });

  it('shows phone verification action when phone verification is required', () => {
    const onVerifyPhone = vi.fn();

    render(renderPhoneVerificationRequiredContent({ onVerifyPhone }));

    expect(screen.getByText('profile.phoneTrialHint')).toBeInTheDocument();
    fireEvent.click(screen.getByText('profile.phoneVerifyAction'));

    expect(onVerifyPhone).toHaveBeenCalledTimes(1);
  });
});
