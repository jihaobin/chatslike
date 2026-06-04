'use client';

import { LoadingOutlined } from '@ant-design/icons';
import { Button, Flexbox, Input, Text } from '@lobehub/ui';
import { type InputRef, Spin } from 'antd';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { message } from '@/components/AntdStaticMethods';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/selectors';

import ProfileRow from './ProfileRow';

const PHONE_REGEX = /^\+?[\d\s\-()]{6,32}$/;

const PhoneVerificationRow = () => {
  const { t } = useTranslation('auth');
  const phone = useUserStore(userProfileSelectors.phone);
  const phoneNumberVerified = useUserStore(userProfileSelectors.phoneNumberVerified);
  const verifyPhoneForTrial = useUserStore((s) => s.verifyPhoneForTrial);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<InputRef>(null);

  const handleVerify = useCallback(async () => {
    const value = inputRef.current?.input?.value?.trim();

    if (!value) {
      setError(t('profile.phoneRequired'));
      return;
    }

    if (!PHONE_REGEX.test(value)) {
      setError(t('profile.phoneInvalid'));
      return;
    }

    try {
      setVerifying(true);
      setError('');
      await verifyPhoneForTrial(value);
      message.success(t('profile.phoneTrialGranted'));
    } catch (err) {
      console.error('Failed to verify phone for trial credits:', err);
      setError(t('profile.phoneVerifyFailed'));
    } finally {
      setVerifying(false);
    }
  }, [t, verifyPhoneForTrial]);

  return (
    <ProfileRow
      label={t('profile.phone')}
      action={
        phoneNumberVerified ? (
          <Text style={{ fontSize: 13 }} type="success">
            {t('profile.phoneVerified')}
          </Text>
        ) : (
          <Button loading={verifying} size="small" type="primary" onClick={handleVerify}>
            {t('profile.phoneVerifyAction')}
          </Button>
        )
      }
    >
      <Flexbox gap={6}>
        <Flexbox horizontal align="center" gap={8}>
          {verifying && <Spin indicator={<LoadingOutlined spin />} size="small" />}
          <Input
            defaultValue={phone || ''}
            disabled={phoneNumberVerified || verifying}
            key={phone}
            placeholder={t('profile.phonePlaceholder')}
            ref={inputRef}
            status={error ? 'error' : undefined}
            variant="filled"
            onPressEnter={handleVerify}
            onChange={() => {
              if (error) setError('');
            }}
          />
        </Flexbox>
        {error ? (
          <Text style={{ fontSize: 12 }} type="danger">
            {error}
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
