import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { type GenerationBatch } from '@/types/generation';

import {
  type InsufficientCreditsParams,
  isInsufficientCreditsError,
  isPhoneVerificationRequiredError,
  renderInsufficientCreditsContent,
  renderPhoneVerificationRequiredContent,
} from './useBusinessErrorContent';

const toNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

const getBillingError = (batch: GenerationBatch) =>
  batch.generations.find((generation) => generation.task.metadata?.billingError)?.task.metadata
    ?.billingError;

const getInsufficientCreditsParams = (
  billingError: NonNullable<ReturnType<typeof getBillingError>>,
): InsufficientCreditsParams => ({
  availableCredits: toNumber(billingError.availableCredits),
  deficitCredits: toNumber(billingError.deficitCredits),
  requiredCredits: toNumber(billingError.requiredCredits),
});

export default function useRenderGenerationBusinessBatchItem(batch: GenerationBatch) {
  const navigate = useNavigate();

  return useMemo(() => {
    const billingError = getBillingError(batch);
    const errorCode = typeof billingError?.code === 'string' ? billingError.code : undefined;

    if (isPhoneVerificationRequiredError(errorCode)) {
      return {
        businessBatchItem: renderPhoneVerificationRequiredContent({
          onVerifyPhone: () => navigate('/settings/profile'),
        }),
        shouldRenderBusinessBatchItem: true,
      };
    }

    if (isInsufficientCreditsError(errorCode) && billingError) {
      return {
        businessBatchItem: renderInsufficientCreditsContent(
          getInsufficientCreditsParams(billingError),
          {
            onInviteFriends: () => navigate('/settings/referral'),
            onTopUpCredits: () => navigate('/settings/credits'),
            onUpgradePlan: () => navigate('/settings/plans'),
          },
        ),
        shouldRenderBusinessBatchItem: true,
      };
    }

    return {
      businessBatchItem: null,
      shouldRenderBusinessBatchItem: false,
    };
  }, [batch, navigate]);
}
