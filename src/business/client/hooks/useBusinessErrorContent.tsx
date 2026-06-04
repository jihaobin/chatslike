import { type ErrorType } from '@lobechat/types';
import { Button, Center, Flexbox, FluentEmoji, Text } from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { t } from 'i18next';
import { GiftIcon } from 'lucide-react';
import { useMemo } from 'react';

import { formatNumber } from '@/utils/format';

export const INSUFFICIENT_CREDITS_ERROR_CODE = 'INSUFFICIENT_CREDITS';
export const PHONE_VERIFICATION_REQUIRED_ERROR_CODE = 'PHONE_VERIFICATION_REQUIRED';

const styles = createStaticStyles(({ css }) => ({
  action: css`
    height: 48px;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 600;
  `,
  card: css`
    width: 100%;
    max-width: 620px;
    margin-inline: auto;
    padding-block: 28px;
  `,
  desc: css`
    color: ${cssVar.colorTextSecondary};
    font-size: 15px;
    text-align: center;
  `,
  icon: css`
    border-radius: 12px;
    background: ${cssVar.colorFillTertiary};
  `,
  label: css`
    color: ${cssVar.colorTextSecondary};
    font-size: 14px;
  `,
  metrics: css`
    width: min(100%, 360px);
  `,
  referral: css`
    cursor: pointer;
    color: ${cssVar.colorTextSecondary};
    font-size: 14px;

    &:hover {
      color: ${cssVar.colorText};
    }
  `,
  shortfall: css`
    color: ${cssVar.colorError};
  `,
  title: css`
    margin: 0;
    color: ${cssVar.colorText};
    font-size: 22px;
    font-weight: 700;
    line-height: 1.35;
  `,
  value: css`
    color: ${cssVar.colorText};
    font-size: 16px;
    font-weight: 700;
  `,
}));

export interface BusinessErrorContentResult {
  errorType?: string;
  hideMessage?: boolean;
}

export interface InsufficientCreditsParams {
  availableCredits: number;
  deficitCredits: number;
  requiredCredits: number;
}

export interface InsufficientCreditsActions {
  onInviteFriends?: () => void;
  onTopUpCredits?: () => void;
  onUpgradePlan?: () => void;
}

export interface PhoneVerificationRequiredActions {
  onVerifyPhone?: () => void;
}

export const isInsufficientCreditsError = (errorType?: ErrorType | string) =>
  errorType === INSUFFICIENT_CREDITS_ERROR_CODE;

export const isPhoneVerificationRequiredError = (errorType?: ErrorType | string) =>
  errorType === PHONE_VERIFICATION_REQUIRED_ERROR_CODE;

const renderMetric = (label: string, value: string, danger?: boolean) => (
  <Flexbox horizontal align={'center'} justify={'space-between'}>
    <Text className={styles.label}>{label}</Text>
    <Text className={`${styles.value} ${danger ? styles.shortfall : ''}`}>{value}</Text>
  </Flexbox>
);

export function renderInsufficientCreditsContent(
  params: InsufficientCreditsParams,
  actions: InsufficientCreditsActions = {},
) {
  return (
    <Flexbox align={'center'} className={styles.card} gap={18}>
      <Center className={styles.icon} height={84} width={84}>
        <FluentEmoji emoji={'💰'} size={56} type={'anim'} />
      </Center>
      <Text as={'h3'} className={styles.title}>
        {t('limitation.insufficientBudget.title', { ns: 'subscription' })}
      </Text>
      <Text className={styles.desc}>
        {t('limitation.insufficientBudget.estimatedDesc', { ns: 'subscription' })}
      </Text>
      <Flexbox className={styles.metrics} gap={10}>
        {renderMetric(
          t('limitation.insufficientBudget.available', { ns: 'subscription' }),
          formatNumber(params.availableCredits),
        )}
        {renderMetric(
          t('limitation.insufficientBudget.required', { ns: 'subscription' }),
          formatNumber(params.requiredCredits),
        )}
        {renderMetric(
          t('limitation.insufficientBudget.shortfall', { ns: 'subscription' }),
          formatNumber(params.deficitCredits),
          true,
        )}
      </Flexbox>
      <Flexbox className={styles.metrics} gap={10}>
        <Button block className={styles.action} type={'primary'} onClick={actions.onUpgradePlan}>
          {t('limitation.limited.upgradeToPlan', {
            ns: 'subscription',
            plan: t('billingNative.plans.planName.starter', { ns: 'subscription' }),
          })}
        </Button>
        <Button block className={styles.action} onClick={actions.onTopUpCredits}>
          {t('limitation.limited.topup', { ns: 'subscription' })}
        </Button>
      </Flexbox>
      <Flexbox
        horizontal
        align={'center'}
        className={styles.referral}
        gap={8}
        onClick={actions.onInviteFriends}
      >
        <GiftIcon size={16} />
        {t('limitation.limited.referralTip', { ns: 'subscription', reward: 2 })}
      </Flexbox>
    </Flexbox>
  );
}

export function renderPhoneVerificationRequiredContent(
  actions: PhoneVerificationRequiredActions = {},
) {
  return (
    <Flexbox align={'center'} className={styles.card} gap={18}>
      <Center className={styles.icon} height={84} width={84}>
        <FluentEmoji emoji={'📱'} size={56} type={'anim'} />
      </Center>
      <Text as={'h3'} className={styles.title}>
        {t('profile.phone', { ns: 'auth' })}
      </Text>
      <Text className={styles.desc}>{t('profile.phoneTrialHint', { ns: 'auth' })}</Text>
      <Flexbox className={styles.metrics}>
        <Button block className={styles.action} type={'primary'} onClick={actions.onVerifyPhone}>
          {t('profile.phoneVerifyAction', { ns: 'auth' })}
        </Button>
      </Flexbox>
    </Flexbox>
  );
}

export default function useBusinessErrorContent(
  errorType?: ErrorType | string,
): BusinessErrorContentResult {
  return useMemo(() => {
    if (isInsufficientCreditsError(errorType)) {
      return {
        errorType: INSUFFICIENT_CREDITS_ERROR_CODE,
        hideMessage: true,
      };
    }

    if (isPhoneVerificationRequiredError(errorType)) {
      return {
        errorType: PHONE_VERIFICATION_REQUIRED_ERROR_CODE,
        hideMessage: true,
      };
    }

    return {};
  }, [errorType]);
}
