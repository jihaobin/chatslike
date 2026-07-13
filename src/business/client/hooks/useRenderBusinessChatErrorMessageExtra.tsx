import { type ChatMessageError } from '@lobechat/types';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  renderInsufficientCreditsContent,
  renderPhoneVerificationRequiredContent,
} from './BusinessErrorContent';
import {
  type InsufficientCreditsParams,
  isInsufficientCreditsError,
  isPhoneVerificationRequiredError,
} from './useBusinessErrorContent';

const toNumber = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

const getInsufficientCreditsParams = (
  error: ChatMessageError | null | undefined,
): InsufficientCreditsParams => ({
  availableCredits: toNumber(error?.body?.availableCredits),
  deficitCredits: toNumber(error?.body?.deficitCredits),
  requiredCredits: toNumber(error?.body?.requiredCredits),
});

export default function useRenderBusinessChatErrorMessageExtra(
  error: ChatMessageError | null | undefined,
  // eslint-disable-next-line unused-imports/no-unused-vars
  messageId?: string,
) {
  const navigate = useNavigate();

  return useMemo(() => {
    if (isPhoneVerificationRequiredError(error?.type)) {
      return renderPhoneVerificationRequiredContent({
        onVerifyPhone: () => navigate('/settings/profile'),
      });
    }

    if (!isInsufficientCreditsError(error?.type)) return null;

    return renderInsufficientCreditsContent(getInsufficientCreditsParams(error), {
      onInviteFriends: () => navigate('/settings/referral'),
      onTopUpCredits: () => navigate('/settings/credits'),
      onUpgradePlan: () => navigate('/settings/plans'),
    });
  }, [error, navigate]);
}
