import { BRANDING_NAME } from '@lobechat/business-const';
import { Button, Flexbox, Icon, Input, Text } from '@lobehub/ui';
import { Form } from 'antd';
import { createStaticStyles } from 'antd-style';
import { MessageSquareText, Phone } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { message } from '@/components/AntdStaticMethods';
import { PRIVACY_URL, TERMS_URL } from '@/const/url';
import { phoneNumber } from '@/libs/better-auth/auth-client';

const COUNTDOWN_SECONDS = 60;
const MAINLAND_CHINA_PHONE_REGEX = /^1[3-9]\d{9}$/;

interface PhoneFormValues {
  code: string;
  phoneNumber: string;
}

const styles = createStaticStyles(({ css, cssVar }) => ({
  agreementLink: css`
    color: inherit;
    text-decoration: underline;
  `,

  codeGroup: css`
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px;

    @media (width <= 480px) {
      grid-template-columns: 1fr;
    }
  `,

  form: css`
    .ant-form-item {
      margin-block-end: 16px;
    }

    .ant-form-item-label {
      padding-block-end: 8px;
      font-weight: 600;
    }

    .ant-input-affix-wrapper {
      min-height: 46px;
      border-radius: 10px;
      background: ${cssVar.colorBgContainer};
    }
  `,

  primaryButton: css`
    height: 46px;
    border-color: #0757ff;
    border-radius: 999px;

    font-weight: 700;

    background: #0757ff;
    box-shadow: 0 16px 32px rgb(7 87 255 / 20%);

    &:hover,
    &:focus {
      border-color: #0757ff !important;
      background: #0757ff !important;
    }
  `,

  sendButton: css`
    min-width: 126px;
    height: 46px;
    border-radius: 999px;

    font-weight: 700;
    color: #0757ff;

    @media (width <= 480px) {
      width: 100%;
    }
  `,
}));

export const SignInPhoneStep = () => {
  const [form] = Form.useForm<PhoneFormValues>();
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation('auth');

  useEffect(() => {
    if (countdown <= 0) return;

    const timer = window.setTimeout(() => {
      setCountdown((value) => Math.max(value - 1, 0));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [countdown]);

  const handleSendCode = async () => {
    try {
      const { phoneNumber: phone } = await form.validateFields(['phoneNumber']);
      setSending(true);
      const result = await phoneNumber.sendOtp({ phoneNumber: phone });

      if (result?.error) {
        message.error(result.error.message || t('profile.phoneSendCodeFailed'));
        return;
      }

      setCountdown(COUNTDOWN_SECONDS);
      message.success(t('profile.phoneCodeSent', { phone }));
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message || t('profile.phoneSendCodeFailed'));
        return;
      }

      if (!error || typeof error !== 'object' || !('errorFields' in error)) {
        message.error(t('profile.phoneSendCodeFailed'));
      }
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = async (values: PhoneFormValues) => {
    try {
      setVerifying(true);
      const result = await phoneNumber.verify({
        code: values.code,
        phoneNumber: values.phoneNumber,
      });

      if (result?.error) {
        message.error(result.error.message || t('profile.phoneVerifyFailed'));
        return;
      }

      router.push(searchParams.get('callbackUrl') || '/');
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('profile.phoneVerifyFailed'));
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Flexbox gap={24}>
      <Flexbox gap={8}>
        <Text fontSize={28} style={{ lineHeight: 1.2 }} weight={'bold'}>
          {t('signin.title')}
        </Text>
        <Text fontSize={15} style={{ lineHeight: 1.5 }} type={'secondary'}>
          {t('signin.subtitle', { appName: BRANDING_NAME })}
        </Text>
      </Flexbox>
      <Form className={styles.form} form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          label={t('betterAuth.signin.phoneStep.phoneLabel')}
          name="phoneNumber"
          rules={[
            { message: t('profile.phoneRequired'), required: true },
            {
              pattern: MAINLAND_CHINA_PHONE_REGEX,
              message: t('profile.phoneInvalid'),
            },
          ]}
        >
          <Input
            autoComplete="tel"
            inputMode="tel"
            placeholder={t('betterAuth.signin.phoneStep.phonePlaceholder')}
            prefix={<Icon icon={Phone} />}
            size="large"
          />
        </Form.Item>
        <Form.Item required label={t('betterAuth.signin.phoneStep.codeLabel')}>
          <div className={styles.codeGroup}>
            <Form.Item
              noStyle
              name="code"
              rules={[
                { message: t('profile.phoneCodeRequired'), required: true },
                { len: 6, message: t('profile.phoneCodeInvalid') },
              ]}
            >
              <Input
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={6}
                placeholder={t('betterAuth.signin.phoneStep.codePlaceholder')}
                prefix={<Icon icon={MessageSquareText} />}
                size="large"
              />
            </Form.Item>
            <Button
              className={styles.sendButton}
              disabled={countdown > 0}
              loading={sending}
              onClick={handleSendCode}
            >
              {countdown > 0
                ? t('betterAuth.signin.phoneStep.sendCodeCountdown', { seconds: countdown })
                : t('betterAuth.signin.phoneStep.sendCode')}
            </Button>
          </div>
        </Form.Item>
        <Button
          block
          className={styles.primaryButton}
          htmlType="submit"
          loading={verifying}
          type="primary"
        >
          {t('betterAuth.signin.phoneStep.submit')}
        </Button>
      </Form>
      <Text align={'center'} fontSize={12} type={'secondary'}>
        <Trans
          i18nKey={'footer.agreement'}
          ns={'auth'}
          components={{
            privacy: <a className={styles.agreementLink} href={PRIVACY_URL} />,
            terms: <a className={styles.agreementLink} href={TERMS_URL} />,
          }}
        />
      </Text>
    </Flexbox>
  );
};
