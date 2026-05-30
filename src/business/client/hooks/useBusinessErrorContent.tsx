import { type ErrorType } from '@lobechat/types';
import { Flexbox, Text } from '@lobehub/ui';
import { t } from 'i18next';

import { formatNumber } from '@/utils/format';

export const INSUFFICIENT_CREDITS_ERROR_CODE = 'INSUFFICIENT_CREDITS';

export interface BusinessErrorContentResult {
  errorType?: string;
  hideMessage?: boolean;
}

export interface InsufficientCreditsParams {
  availableCredits: number;
  deficitCredits: number;
  requiredCredits: number;
}

export const isInsufficientCreditsError = (errorType?: ErrorType | string) =>
  errorType === INSUFFICIENT_CREDITS_ERROR_CODE;

export function renderInsufficientCreditsContent(params: InsufficientCreditsParams) {
  return (
    <Flexbox gap={8}>
      <Text as={'h3'} style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
        {t('limitation.insufficientBudget.title', { ns: 'subscription' })}
      </Text>
      <Flexbox gap={4}>
        <Text>{t('limitation.insufficientBudget.required', { ns: 'subscription' })}</Text>
        <Text>{formatNumber(params.requiredCredits)}</Text>
      </Flexbox>
      <Flexbox gap={4}>
        <Text>{t('limitation.insufficientBudget.available', { ns: 'subscription' })}</Text>
        <Text>{formatNumber(params.availableCredits)}</Text>
      </Flexbox>
      <Flexbox gap={4}>
        <Text>{t('limitation.insufficientBudget.shortfall', { ns: 'subscription' })}</Text>
        <Text>{formatNumber(params.deficitCredits)}</Text>
      </Flexbox>
    </Flexbox>
  );
}

export default function useBusinessErrorContent(
  errorType?: ErrorType | string,
): BusinessErrorContentResult {
  if (isInsufficientCreditsError(errorType)) {
    return {
      errorType: INSUFFICIENT_CREDITS_ERROR_CODE,
      hideMessage: true,
    };
  }

  return {};
}
