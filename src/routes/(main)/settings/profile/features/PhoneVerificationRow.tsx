'use client';

import { LoadingOutlined } from '@ant-design/icons';
import { Button, Flexbox, Input, Text } from '@lobehub/ui';
import { type InputRef, Spin } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { message } from '@/components/AntdStaticMethods';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/selectors';

import ProfileRow from './ProfileRow';

const PHONE_REGEX = /^\+?[\d\s\-()]{6,32}$/;
const CODE_REGEX = /^\d{6}$/;
const PHONE_ERROR_TRANSLATION_KEYS = {
  PHONE_ALREADY_BOUND: 'profile.phoneAlreadyBound',
  PHONE_CODE_ATTEMPTS_EXCEEDED: 'profile.phoneCodeAttemptsExceeded',
  PHONE_CODE_EXPIRED: 'profile.phoneCodeExpired',
  PHONE_CODE_INVALID: 'profile.phoneCodeInvalid',
  PHONE_CODE_SEND_TOO_FREQUENT: 'profile.phoneCodeSendTooFrequent',
  PHONE_VERIFICATION_REDIS_REQUIRED: 'profile.phoneServiceUnavailable',
  PHONE_VERIFICATION_SECRET_REQUIRED: 'profile.phoneServiceUnavailable',
  SMS_CONFIG_MISSING: 'profile.phoneServiceUnavailable',
  SMS_SEND_FAILED: 'profile.phoneSendCodeFailed',
} as const;

const getErrorRecord = (error: unknown): Record<string, unknown> | undefined => {
  if (!error || typeof error !== 'object') return;

  return error as Record<string, unknown>;
};

const getPhoneErrorMessageKey = (error: unknown) => {
  const record = getErrorRecord(error);
  const data = getErrorRecord(record?.data);
  const message = typeof record?.message === 'string' ? record.message : undefined;
  const dataMessage = typeof data?.message === 'string' ? data.message : undefined;
  const code = typeof data?.code === 'string' ? data.code : undefined;
  const key = dataMessage || message || code;

  if (!key) return;

  return PHONE_ERROR_TRANSLATION_KEYS[key as keyof typeof PHONE_ERROR_TRANSLATION_KEYS];
};

const PhoneVerificationRow = () => {
  const { t } = useTranslation('auth');
  const phone = useUserStore(userProfileSelectors.phone);
  const phoneNumberVerified = useUserStore(userProfileSelectors.phoneNumberVerified);
  const sendPhoneVerificationCode = useUserStore((s) => s.sendPhoneVerificationCode);
  const verifyPhoneForTrial = useUserStore((s) => s.verifyPhoneForTrial);
  const [submitting, setSubmitting] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const inputRef = useRef<InputRef>(null);
  const codeInputRef = useRef<InputRef>(null);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;

    const timer = window.setTimeout(() => {
      setCooldownSeconds((value) => Math.max(0, value - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [cooldownSeconds]);

  const getPhoneValue = useCallback(() => inputRef.current?.input?.value?.trim() || '', []);

  const validatePhone = useCallback(
    (value: string) => {
      if (!value) {
        setError(t('profile.phoneRequired'));
        return false;
      }

      if (!PHONE_REGEX.test(value)) {
        setError(t('profile.phoneInvalid'));
        return false;
      }

      return true;
    },
    [t],
  );

  const handleSendCode = useCallback(async () => {
    const value = getPhoneValue();
    if (!validatePhone(value)) return;

    try {
      setSubmitting(true);
      setError('');
      const result = await sendPhoneVerificationCode(value);
      setMaskedPhone(result.maskedPhone);
      setCooldownSeconds(result.cooldownSeconds);
      setCodeSent(true);
      message.success(t('profile.phoneCodeSent', { phone: result.maskedPhone }));
    } catch (error) {
      setError(t(getPhoneErrorMessageKey(error) || 'profile.phoneSendCodeFailed'));
    } finally {
      setSubmitting(false);
    }
  }, [getPhoneValue, sendPhoneVerificationCode, t, validatePhone]);

  const handleVerify = useCallback(async () => {
    const phoneValue = getPhoneValue();
    if (!validatePhone(phoneValue)) return;

    const code = codeInputRef.current?.input?.value?.trim() || '';
    if (!code) {
      setError(t('profile.phoneCodeRequired'));
      return;
    }

    if (!CODE_REGEX.test(code)) {
      setError(t('profile.phoneCodeInvalid'));
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      const result = await verifyPhoneForTrial({ code, phoneNumber: phoneValue });
      message.success(
        t(
          result.trial.granted
            ? 'profile.phoneTrialGranted'
            : 'profile.phoneVerifiedTrialAlreadyClaimed',
        ),
      );
    } catch (error) {
      setError(t(getPhoneErrorMessageKey(error) || 'profile.phoneVerifyFailed'));
    } finally {
      setSubmitting(false);
    }
  }, [getPhoneValue, t, validatePhone, verifyPhoneForTrial]);

  const action = phoneNumberVerified ? (
    <Text style={{ fontSize: 13 }} type="success">
      {t('profile.phoneVerified')}
    </Text>
  ) : codeSent ? (
    <Button loading={submitting} size="small" type="primary" onClick={handleVerify}>
      {t('profile.phoneVerifyCodeAction')}
    </Button>
  ) : (
    <Button loading={submitting} size="small" type="primary" onClick={handleSendCode}>
      {t('profile.phoneSendCodeAction')}
    </Button>
  );

  return (
    <ProfileRow action={action} label={t('profile.phone')}>
      <Flexbox gap={6}>
        <Flexbox horizontal align="center" gap={8}>
          {submitting && <Spin indicator={<LoadingOutlined spin />} size="small" />}
          <Input
            defaultValue={phone || ''}
            disabled={phoneNumberVerified || submitting || codeSent}
            key={phone}
            placeholder={t('profile.phonePlaceholder')}
            ref={inputRef}
            status={error ? 'error' : undefined}
            variant="filled"
            onPressEnter={codeSent ? handleVerify : handleSendCode}
            onChange={() => {
              if (error) setError('');
            }}
          />
        </Flexbox>
        {codeSent && !phoneNumberVerified && (
          <Flexbox horizontal align="center" gap={8}>
            <Input
              disabled={submitting}
              placeholder={t('profile.phoneCodePlaceholder')}
              ref={codeInputRef}
              status={error ? 'error' : undefined}
              variant="filled"
              onPressEnter={handleVerify}
              onChange={() => {
                if (error) setError('');
              }}
            />
            <Button
              disabled={cooldownSeconds > 0 || submitting}
              size="small"
              onClick={handleSendCode}
            >
              {cooldownSeconds > 0
                ? t('profile.phoneResendCountdown', { seconds: cooldownSeconds })
                : t('profile.phoneSendCodeAction')}
            </Button>
          </Flexbox>
        )}
        {error ? (
          <Text style={{ fontSize: 12 }} type="danger">
            {error}
          </Text>
        ) : codeSent ? (
          <Text style={{ fontSize: 12 }} type="secondary">
            {t('profile.phoneCodeSent', { phone: maskedPhone })}
          </Text>
        ) : (
          !phoneNumberVerified && (
            <Text style={{ fontSize: 12 }} type="secondary">
              {t('profile.phoneTrialHint')}
            </Text>
          )
        )}
      </Flexbox>
    </ProfileRow>
  );
};

export default PhoneVerificationRow;
