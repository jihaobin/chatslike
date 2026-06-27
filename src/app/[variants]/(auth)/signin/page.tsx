'use client';

import { Flexbox, Segmented } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Loading from '@/components/Loading/BrandTextLoading';

import { SignInPhoneStep } from './SignInPhoneStep';
import { WechatQRCode } from './WechatQRCode';

enum SignInTab {
  Phone = 'phone',
  Wechat = 'wechat',
}

const styles = createStaticStyles(({ css, cssVar }) => ({
  card: css`
    position: relative;
    z-index: 1;

    width: min(100%, 440px);
    padding: 28px;
    border: 1px solid rgb(7 87 255 / 10%);
    border-radius: 20px;

    background: rgb(255 255 255 / 86%);
    backdrop-filter: blur(18px);
    box-shadow: 0 24px 80px rgb(7 87 255 / 16%);

    @media (width <= 480px) {
      padding: 22px;
    }
  `,

  container: css`
    position: relative;

    overflow: hidden;

    width: min(100%, 720px);
    min-height: min(72vh, 680px);
    padding-block: 40px;
    padding-inline: 16px;

    &::before {
      content: '';

      position: absolute;
      inset: 0;

      background:
        radial-gradient(circle at 50% 12%, rgb(7 87 255 / 22%), transparent 32%),
        radial-gradient(circle at 12% 88%, rgb(64 196 255 / 14%), transparent 28%),
        linear-gradient(90deg, rgb(7 87 255 / 7%) 1px, transparent 1px),
        linear-gradient(0deg, rgb(7 87 255 / 7%) 1px, transparent 1px);
      background-size:
        auto,
        auto,
        28px 28px,
        28px 28px;

      mask-image: radial-gradient(circle at center, black 0%, black 56%, transparent 78%);
    }
  `,

  segmented: css`
    padding: 4px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 999px;
    background: ${cssVar.colorFillQuaternary};

    .ant-segmented-item {
      border-radius: 999px;
      font-weight: 700;
    }

    .ant-segmented-thumb,
    .ant-segmented-item-selected {
      color: #0757ff;
      background: ${cssVar.colorBgContainer};
      box-shadow: 0 8px 24px rgb(7 87 255 / 14%);
    }
  `,
}));

const SignInContent = () => {
  const [tab, setTab] = useState<SignInTab>(SignInTab.Phone);
  const { t } = useTranslation('auth');

  return (
    <Flexbox align={'center'} className={styles.container} justify={'center'}>
      <Flexbox className={styles.card} gap={24}>
        <Segmented
          block
          className={styles.segmented}
          value={tab}
          variant={'filled'}
          options={[
            {
              label: t('betterAuth.signin.phoneStep.tabPhone'),
              value: SignInTab.Phone,
            },
            {
              label: t('betterAuth.signin.phoneStep.tabWechat'),
              value: SignInTab.Wechat,
            },
          ]}
          onChange={(value) => setTab(value as SignInTab)}
        />
        {tab === SignInTab.Phone ? <SignInPhoneStep /> : <WechatQRCode />}
      </Flexbox>
    </Flexbox>
  );
};

const SignInPage = () => (
  <Suspense fallback={<Loading debugId={'Signin'} />}>
    <SignInContent />
  </Suspense>
);

export default SignInPage;
