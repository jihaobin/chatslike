import { type ChatMessageError } from '@lobechat/types';
import { Button, Flexbox } from '@lobehub/ui';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import {
  type InsufficientCreditsParams,
  isInsufficientCreditsError,
  renderInsufficientCreditsContent,
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
  const { t } = useTranslation('error');

  return useMemo(() => {
    if (!isInsufficientCreditsError(error?.type)) return null;

    return (
      <Flexbox gap={12}>
        {renderInsufficientCreditsContent(getInsufficientCreditsParams(error))}
        <Flexbox horizontal gap={8} wrap={'wrap'}>
          <Button onClick={() => navigate('/settings/credits')} type={'primary'}>
            {t('billingError.actions.topUp', 'Top up Credits')}
          </Button>
          <Button onClick={() => navigate('/settings/plans')}>
            {t('billingError.actions.upgrade', 'Upgrade Plan')}
          </Button>
        </Flexbox>
      </Flexbox>
    );
  }, [error, navigate, t]);
}
