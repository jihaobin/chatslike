'use client';

import { Flexbox, Modal, Text } from '@lobehub/ui';
import { QRCode } from 'antd';
import { createStaticStyles } from 'antd-style';
import { useTranslation } from 'react-i18next';

import { formatBillingAmount } from '../utils';

export type PaymentQrCodeStatus = 'expired' | 'loading' | 'paying' | 'waiting';

interface PaymentQrCodeModalProps {
  amountCents: number;
  currency?: string;
  onOpenChange: (open: boolean) => void;
  onRefresh?: () => void;
  open: boolean;
  orderId: string;
  qrCodeUrl?: string;
  refreshing?: boolean;
  status?: PaymentQrCodeStatus;
}

const styles = createStaticStyles(({ css, cssVar }) => ({
  amount: css`
    font-size: 24px;
    font-weight: 800;
    line-height: 1.1;
  `,
  panel: css`
    align-items: center;
    padding-block: 8px 18px;
    text-align: center;
  `,
  qrWrap: css`
    position: relative;

    padding: 14px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 18px;

    background: ${cssVar.colorBgContainer};
    box-shadow: ${cssVar.boxShadowTertiary};
  `,
  secondary: css`
    color: ${cssVar.colorTextSecondary};
  `,
}));

export const PaymentQrCodeModal = ({
  amountCents,
  currency,
  open,
  orderId,
  qrCodeUrl,
  refreshing,
  status = 'waiting',
  onOpenChange,
  onRefresh,
}: PaymentQrCodeModalProps) => {
  const { t } = useTranslation('subscription');
  const helperText =
    status === 'paying'
      ? t('billingNative.paymentQrCode.payingDesc', 'Scanned. Confirm the payment on your phone.')
      : status === 'expired'
        ? t(
            'billingNative.paymentQrCode.expiredDesc',
            'The QR code has expired. Refresh to try again.',
          )
        : t('billingNative.paymentQrCode.desc', 'Scan to pay');
  const qrCodeStatus =
    status === 'paying'
      ? 'scanned'
      : status === 'loading'
        ? 'loading'
        : status === 'expired'
          ? 'expired'
          : 'active';

  return (
    <Modal
      footer={null}
      open={open && Boolean(qrCodeUrl)}
      title={t('billingNative.paymentQrCode.title', 'Scan to pay')}
      width={420}
      onCancel={() => onOpenChange(false)}
    >
      <Flexbox className={styles.panel} gap={14}>
        <Text className={styles.secondary}>{helperText}</Text>
        {qrCodeUrl ? (
          <div className={styles.qrWrap}>
            <QRCode size={220} status={qrCodeStatus} value={qrCodeUrl} onRefresh={onRefresh} />
          </div>
        ) : null}
        <Text className={styles.amount}>
          {formatBillingAmount(amountCents, currency, {
            maximumFractionDigits: 1,
            minimumFractionDigits: 0,
          })}
        </Text>
        <Text code className={styles.secondary}>
          {orderId}
        </Text>
      </Flexbox>
    </Modal>
  );
};
