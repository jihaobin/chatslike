'use client';

import { Button, Flexbox, Modal, Text } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { useTranslation } from 'react-i18next';

export type PaymentChannel = 'alipay' | 'wechat';

interface PaymentChannelModalProps {
  onOpenChange: (open: boolean) => void;
  onSelect: (channel: PaymentChannel) => void;
  open: boolean;
}

const styles = createStaticStyles(({ css, cssVar }) => ({
  channelButton: css`
    width: 100%;
    min-height: 58px;
    border-radius: 12px;
  `,
  channelMark: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;

    width: 34px;
    height: 34px;
    border-radius: 10px;

    font-size: 13px;
    font-weight: 800;
    color: #fff;
  `,
  desc: css`
    color: ${cssVar.colorTextSecondary};
  `,
}));

const CHANNEL_OPTIONS = [
  { color: '#14a8f5', fallback: 'Alipay', key: 'alipay', mark: 'Ali' },
  { color: '#08bf22', fallback: 'WeChat Pay', key: 'wechat', mark: '✓' },
] as const satisfies Array<{
  color: string;
  fallback: string;
  key: PaymentChannel;
  mark: string;
}>;

export const PaymentChannelModal = ({ open, onOpenChange, onSelect }: PaymentChannelModalProps) => {
  const { t } = useTranslation('subscription');

  return (
    <Modal
      footer={null}
      open={open}
      title={t('billingNative.paymentChannel.modal.title', 'Select payment method')}
      width={420}
      onCancel={() => onOpenChange(false)}
    >
      <Flexbox gap={14}>
        <Text className={styles.desc}>
          {t(
            'billingNative.paymentChannel.modal.desc',
            'Choose a payment channel before creating the order.',
          )}
        </Text>
        <Flexbox gap={10}>
          {CHANNEL_OPTIONS.map((item) => (
            <Button
              aria-label={t(`billingNative.paymentChannel.${item.key}`, item.fallback)}
              className={styles.channelButton}
              key={item.key}
              type={'default'}
              onClick={() => onSelect(item.key)}
            >
              <Flexbox horizontal align={'center'} gap={12}>
                <span className={styles.channelMark} style={{ background: item.color }}>
                  {item.mark}
                </span>
                <Text weight={700}>
                  {t(`billingNative.paymentChannel.${item.key}`, item.fallback)}
                </Text>
              </Flexbox>
            </Button>
          ))}
        </Flexbox>
      </Flexbox>
    </Modal>
  );
};
