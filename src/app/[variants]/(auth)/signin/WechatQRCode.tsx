import { Button, Flexbox, Text } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const styles = createStaticStyles(({ css, cssVar }) => ({
  qrFrame: css`
    display: grid;
    place-items: center;

    width: 180px;
    height: 180px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 20px;

    background:
      linear-gradient(90deg, rgb(7 87 255 / 10%) 1px, transparent 1px),
      linear-gradient(0deg, rgb(7 87 255 / 10%) 1px, transparent 1px), ${cssVar.colorFillQuaternary};
    background-size: 18px 18px;
  `,
}));

export const WechatQRCode = () => {
  const { t } = useTranslation('auth');

  return (
    <Flexbox align={'center'} gap={16} paddingBlock={12}>
      <div className={styles.qrFrame}>
        <Text align={'center'} type={'secondary'}>
          {t('betterAuth.signin.wechatStep.instruction')}
        </Text>
      </div>
      <Text type={'secondary'}>{t('betterAuth.signin.wechatStep.expiry')}</Text>
      <Button disabled icon={RefreshCw} shape={'round'}>
        {t('betterAuth.signin.wechatStep.refresh')}
      </Button>
    </Flexbox>
  );
};
