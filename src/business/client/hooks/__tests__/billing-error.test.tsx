import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  renderInsufficientCreditsContent,
  renderPhoneVerificationRequiredContent,
} from '../useBusinessErrorContent';

const navigateMock = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const resources: Record<string, string> = {
        'billingNative.plans.planName.starter': 'Starter',
        'limitation.insufficientBudget.available': 'Available Credits',
        'limitation.insufficientBudget.estimatedDesc':
          'This request is estimated to need more credits. Top up credits or upgrade your plan.',
        'limitation.insufficientBudget.required': 'Required Credits',
        'limitation.insufficientBudget.shortfall': 'Credit Shortfall',
        'limitation.insufficientBudget.title': 'Insufficient Credits',
        'limitation.limited.referralTip': 'Invite friends, both get {{reward}}M',
        'limitation.limited.topup': 'Top-Up Credits',
        'limitation.limited.upgradeToPlan': 'Upgrade to {{plan}}',
        'profile.phoneTrialHint': 'Verify your phone to claim trial credits.',
        'profile.phoneVerifyAction': 'Verify Phone',
      };

      return (resources[key] ?? key).replaceAll(/\{\{(\w+)\}\}/g, (_, name: string) =>
        String(params?.[name] ?? ''),
      );
    },
  }),
}));

vi.mock('i18next', () => ({
  t: (key: string) => key,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('@lobehub/ui', () => ({
  Button: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => (
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

    expect(screen.getByText('Insufficient Credits')).toBeInTheDocument();
    expect(screen.getByText('Required Credits')).toBeInTheDocument();
    expect(screen.getByText('Available Credits')).toBeInTheDocument();
    expect(screen.getByText('Credit Shortfall')).toBeInTheDocument();
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

    expect(
      screen.getByText(
        'This request is estimated to need more credits. Top up credits or upgrade your plan.',
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText('Upgrade to Starter'));
    fireEvent.click(screen.getByText('Top-Up Credits'));
    fireEvent.click(screen.getByText('Invite friends, both get 2M'));

    expect(onUpgradePlan).toHaveBeenCalledTimes(1);
    expect(onTopUpCredits).toHaveBeenCalledTimes(1);
    expect(onInviteFriends).toHaveBeenCalledTimes(1);
  });

  it('shows phone verification action when phone verification is required', () => {
    const onVerifyPhone = vi.fn();

    render(renderPhoneVerificationRequiredContent({ onVerifyPhone }));

    expect(screen.getByText('Verify your phone to claim trial credits.')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Verify Phone'));

    expect(onVerifyPhone).toHaveBeenCalledTimes(1);
  });
});
