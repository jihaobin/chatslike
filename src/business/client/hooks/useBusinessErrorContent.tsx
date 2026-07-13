import { type ErrorType } from '@lobechat/types';
import { useMemo } from 'react';

export const INSUFFICIENT_CREDITS_ERROR_CODE = 'INSUFFICIENT_CREDITS';
export const PHONE_VERIFICATION_REQUIRED_ERROR_CODE = 'PHONE_VERIFICATION_REQUIRED';

export interface BusinessErrorContentResult {
  errorType?: string;
  hideMessage?: boolean;
}

export interface InsufficientCreditsParams {
  availableCredits: number;
  deficitCredits: number;
  requiredCredits: number;
}

export interface InsufficientCreditsActions {
  onInviteFriends?: () => void;
  onTopUpCredits?: () => void;
  onUpgradePlan?: () => void;
}

export interface PhoneVerificationRequiredActions {
  onVerifyPhone?: () => void;
}

export const isInsufficientCreditsError = (errorType?: ErrorType | string) =>
  errorType === INSUFFICIENT_CREDITS_ERROR_CODE;

export const isPhoneVerificationRequiredError = (errorType?: ErrorType | string) =>
  errorType === PHONE_VERIFICATION_REQUIRED_ERROR_CODE;

export default function useBusinessErrorContent(
  errorType?: ErrorType | string,
): BusinessErrorContentResult {
  return useMemo(() => {
    if (isInsufficientCreditsError(errorType)) {
      return {
        errorType: INSUFFICIENT_CREDITS_ERROR_CODE,
        hideMessage: true,
      };
    }

    if (isPhoneVerificationRequiredError(errorType)) {
      return {
        errorType: PHONE_VERIFICATION_REQUIRED_ERROR_CODE,
        hideMessage: true,
      };
    }

    return {};
  }, [errorType]);
}
