import { type ErrorType } from '@lobechat/types';
import { type AlertProps } from '@lobehub/ui';

import { isInsufficientCreditsError } from './useBusinessErrorContent';

export default function useBusinessErrorAlertConfig(errorType?: ErrorType | string): AlertProps | undefined {
  if (isInsufficientCreditsError(errorType)) {
    return {
      type: 'secondary',
    };
  }

  return undefined;
}
