import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { GenerationBatch } from '@/types/generation';

import useRenderBusinessBatchItem from '../useRenderBusinessBatchItem';
import useRenderBusinessVideoBatchItem from '../useRenderBusinessVideoBatchItem';

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
        'profile.phone': 'Phone',
        'profile.phoneVerificationRequiredDesc': 'Verify your phone number to continue.',
        'profile.phoneVerifyAction': 'Verify Phone',
      };

      return (resources[key] ?? key).replaceAll(/\{\{(\w+)\}\}/g, (_, name: string) =>
        String(params?.[name] ?? ''),
      );
    },
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@lobehub/ui', () => ({
  Button: ({ children }: { children?: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
  Center: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Flexbox: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  FluentEmoji: ({ emoji }: { emoji: string }) => <span>{emoji}</span>,
  Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

const createBatch = (
  billingError: NonNullable<
    GenerationBatch['generations'][number]['task']['metadata']
  >['billingError'],
): GenerationBatch => ({
  createdAt: new Date('2026-06-10T00:00:00Z'),
  generations: [
    {
      asyncTaskId: 'task-id',
      createdAt: new Date('2026-06-10T00:00:00Z'),
      id: 'generation-id',
      task: {
        error: {
          body: { detail: 'billing failed' },
          name: String(billingError?.code),
        },
        id: 'task-id',
        metadata: {
          billingError,
        },
        status: 'error' as any,
      },
    },
  ],
  id: 'batch-id',
  model: 'gpt-image-1',
  prompt: 'generate an image',
  provider: 'lobehub',
});

const ImageBusinessItemProbe = ({ batch }: { batch: GenerationBatch }) => {
  const { businessBatchItem, shouldRenderBusinessBatchItem } = useRenderBusinessBatchItem(batch);

  return <>{shouldRenderBusinessBatchItem ? businessBatchItem : 'fallback'}</>;
};

const VideoBusinessItemProbe = ({ batch }: { batch: GenerationBatch }) => {
  const { businessBatchItem, shouldRenderBusinessBatchItem } =
    useRenderBusinessVideoBatchItem(batch);

  return <>{shouldRenderBusinessBatchItem ? businessBatchItem : 'fallback'}</>;
};

describe('generation batch business error hooks', () => {
  it('renders insufficient credits content for image generation billing errors', () => {
    render(
      <ImageBusinessItemProbe
        batch={createBatch({
          availableCredits: 10_000,
          code: 'INSUFFICIENT_CREDITS',
          deficitCredits: 30_000,
          requiredCredits: 40_000,
        })}
      />,
    );

    expect(screen.getByText('Insufficient Credits')).toBeInTheDocument();
    expect(screen.getByText('40,000')).toBeInTheDocument();
    expect(screen.queryByText('fallback')).not.toBeInTheDocument();
  });

  it('renders phone verification content for video generation billing errors', () => {
    render(
      <VideoBusinessItemProbe
        batch={createBatch({
          code: 'PHONE_VERIFICATION_REQUIRED',
        })}
      />,
    );

    expect(screen.getByText('Verify your phone number to continue.')).toBeInTheDocument();
    expect(screen.getByText('Verify Phone')).toBeInTheDocument();
    expect(screen.queryByText('fallback')).not.toBeInTheDocument();
  });
});
