import { type ErrorType } from '@lobechat/types';
import { type AlertProps } from '@lobehub/ui';

import {
  isInsufficientCreditsError,
  isPhoneVerificationRequiredError,
} from './useBusinessErrorContent';

export default function useBusinessErrorAlertConfig(errorType?: ErrorType | string): AlertProps | undefined {
  if (isInsufficientCreditsError(errorType) || isPhoneVerificationRequiredError(errorType)) {
    return {
      type: 'secondary',
    };
  }

  return undefined;
}
