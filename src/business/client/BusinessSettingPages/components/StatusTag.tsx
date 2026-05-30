import { Tag } from '@lobehub/ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

interface StatusTagProps {
  status?: string | null;
  type: 'account' | 'order' | 'usage';
}

const STATUS_COLOR: Record<string, string> = {
  active: 'success',
  activated: 'success',
  captured: 'success',
  closed: 'default',
  exception: 'error',
  failed: 'error',
  frozen: 'warning',
  paid: 'processing',
  partially_captured: 'warning',
  pending: 'warning',
  refunded: 'default',
  released: 'default',
  risk: 'error',
};

const StatusTag = memo<StatusTagProps>(({ status, type }) => {
  const { t } = useTranslation('subscription');
  const normalizedStatus = status || 'unknown';

  return (
    <Tag color={STATUS_COLOR[normalizedStatus]} size={'small'}>
      {t(`billingNative.status.${type}.${normalizedStatus}`, normalizedStatus)}
    </Tag>
  );
});

StatusTag.displayName = 'StatusTag';

export default StatusTag;
