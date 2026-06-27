import { type ErrorType } from '@lobechat/types';
import { Button, Center, Flexbox, FluentEmoji, Text } from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { GiftIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

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
    font-size: 15px;
    color: ${cssVar.colorTextSecondary};
    text-align: center;
  `,
  icon: css`
    border-radius: 12px;
    background: ${cssVar.colorFillTertiary};
  `,
  label: css`
    font-size: 14px;
    color: ${cssVar.colorTextSecondary};
  `,
  metrics: css`
    width: min(100%, 360px);
  `,
  referral: css`
    cursor: pointer;
    font-size: 14px;
    color: ${cssVar.colorTextSecondary};

    &:hover {
      color: ${cssVar.colorText};
    }
  `,
  shortfall: css`
    color: ${cssVar.colorError};
  `,
  title: css`
    margin: 0;

    font-size: 22px;
    font-weight: 700;
    line-height: 1.35;
    color: ${cssVar.colorText};
  `,
  value: css`
    font-size: 16px;
    font-weight: 700;
    color: ${cssVar.colorText};
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
  return <InsufficientCreditsContent actions={actions} params={params} />;
}

function InsufficientCreditsContent({
  actions,
  params,
}: {
  actions: InsufficientCreditsActions;
  params: InsufficientCreditsParams;
}) {
  const { t } = useTranslation('subscription');

  return (
    <Flexbox align={'center'} className={styles.card} gap={18}>
      <Center className={styles.icon} height={84} width={84}>
        <FluentEmoji emoji={'💰'} size={56} type={'anim'} />
      </Center>
      <Text as={'h3'} className={styles.title}>
        {t('limitation.insufficientBudget.title')}
      </Text>
      <Text className={styles.desc}>{t('limitation.insufficientBudget.estimatedDesc')}</Text>
      <Flexbox className={styles.metrics} gap={10}>
        {renderMetric(
          t('limitation.insufficientBudget.available'),
          formatNumber(params.availableCredits),
        )}
        {renderMetric(
          t('limitation.insufficientBudget.required'),
          formatNumber(params.requiredCredits),
        )}
        {renderMetric(
          t('limitation.insufficientBudget.shortfall'),
          formatNumber(params.deficitCredits),
          true,
        )}
      </Flexbox>
      <Flexbox className={styles.metrics} gap={10}>
        <Button block className={styles.action} type={'primary'} onClick={actions.onUpgradePlan}>
          {t('limitation.limited.upgradeToPlan', {
            plan: t('billingNative.plans.planName.starter'),
          })}
        </Button>
        <Button block className={styles.action} onClick={actions.onTopUpCredits}>
          {t('limitation.limited.topup')}
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
        {t('limitation.limited.referralTip', { reward: 2 })}
      </Flexbox>
    </Flexbox>
  );
}

export function renderPhoneVerificationRequiredContent(
  actions: PhoneVerificationRequiredActions = {},
) {
  return <PhoneVerificationRequiredContent actions={actions} />;
}

function PhoneVerificationRequiredContent({
  actions,
}: {
  actions: PhoneVerificationRequiredActions;
}) {
  const { t } = useTranslation('auth');

  return (
    <Flexbox align={'center'} className={styles.card} gap={18}>
      <Center className={styles.icon} height={84} width={84}>
        <FluentEmoji emoji={'📱'} size={56} type={'anim'} />
      </Center>
      <Text as={'h3'} className={styles.title}>
        {t('profile.phone')}
      </Text>
      <Text className={styles.desc}>{t('profile.phoneVerificationRequiredDesc')}</Text>
      <Flexbox className={styles.metrics}>
        <Button block className={styles.action} type={'primary'} onClick={actions.onVerifyPhone}>
          {t('profile.phoneVerifyAction')}
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
