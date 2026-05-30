'use client';

import { Button, Flexbox, Skeleton, Text } from '@lobehub/ui';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { billingService } from '@/services/billing';
import { formatNumber } from '@/utils/format';

import CreditAmount from './components/CreditAmount';
import { useCurrentSubscription, useSubscriptionPlans } from './hooks/useBillingData';
import { billingPageStyles as styles } from './styles';

const FREE_TRIAL_CREDITS = 500_000;

type PaymentChannel = 'alipay' | 'wechat';
type PlanAction = 'availableAfterExpiry' | 'purchase' | 'renew' | 'unavailable' | 'upgrade';
type SubscriptionPlanId = 'starter' | 'premium' | 'ultimate';
type SubscriptionPeriod = 'month' | 'year';

const PLAN_RANK = {
  premium: 1,
  starter: 0,
  ultimate: 2,
} as const satisfies Record<SubscriptionPlanId, number>;

interface CreatedSubscriptionOrder {
  order: Awaited<ReturnType<typeof billingService.createSubscriptionOrder>>['order'];
  payment: Awaited<ReturnType<typeof billingService.createSubscriptionOrder>>['payment'];
}

const isSubscriptionPlanId = (value: string): value is SubscriptionPlanId => value in PLAN_RANK;

const formatAmount = (amountCents: number, currency = 'CNY') =>
  `${currency} ${(amountCents / 100).toLocaleString('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`;

const Plans = memo(() => {
  const { t } = useTranslation('subscription');
  const { data, isLoading } = useSubscriptionPlans();
  const { data: currentSubscription, isLoading: isCurrentSubscriptionLoading } =
    useCurrentSubscription();
  const [channel, setChannel] = useState<PaymentChannel>('alipay');
  const [createdOrder, setCreatedOrder] = useState<CreatedSubscriptionOrder>();
  const [createOrderError, setCreateOrderError] = useState<string>();
  const [isCreatingOrder, setIsCreatingOrder] = useState<string>();
  const [period, setPeriod] = useState<SubscriptionPeriod>('month');

  if ((isLoading && !data) || (isCurrentSubscriptionLoading && currentSubscription === undefined))
    return <Skeleton active paragraph={{ rows: 6 }} title={false} />;

  const plans = data ?? [];
  const currentPlanId = currentSubscription?.planId;

  const getPlanAction = (planId: SubscriptionPlanId, purchasable: boolean): PlanAction => {
    if (!purchasable) return 'unavailable';
    if (!currentPlanId) return 'purchase';
    if (currentPlanId === planId) return 'renew';

    return PLAN_RANK[planId] > PLAN_RANK[currentPlanId] ? 'upgrade' : 'availableAfterExpiry';
  };

  const handleCreateOrder = async (planId: SubscriptionPlanId, action: PlanAction) => {
    if (action === 'availableAfterExpiry' || action === 'unavailable') return;

    setIsCreatingOrder(`${action}:${planId}`);
    setCreateOrderError(undefined);

    try {
      const result =
        action === 'purchase'
          ? await billingService.createSubscriptionOrder({ channel, period, planId })
          : action === 'renew'
            ? await billingService.createSubscriptionRenewOrder({ channel, period, planId })
            : await billingService.createSubscriptionUpgradeOrder({ channel, targetPlanId: planId });
      setCreatedOrder(result);
    } catch (error) {
      setCreateOrderError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsCreatingOrder(undefined);
    }
  };

  return (
    <Flexbox className={styles.page} gap={16}>
      <Flexbox gap={4}>
        <Text className={styles.header}>{t('billingNative.plans.title', 'Plans')}</Text>
        <Text className={styles.subtitle}>
          {t(
            'billingNative.plans.desc',
            'Compare managed model Credits and purchase a fixed subscription period.',
          )}
        </Text>
      </Flexbox>

      <Flexbox className={styles.section} gap={12} padding={16}>
        <Flexbox horizontal gap={8} wrap={'wrap'}>
          <Button onClick={() => setPeriod('month')} type={period === 'month' ? 'primary' : 'default'}>
            {t('billingNative.plans.period.month', 'Monthly')}
          </Button>
          <Button onClick={() => setPeriod('year')} type={period === 'year' ? 'primary' : 'default'}>
            {t('billingNative.plans.period.year', 'Yearly')}
          </Button>
        </Flexbox>
        <Flexbox horizontal gap={8} wrap={'wrap'}>
          <Button onClick={() => setChannel('alipay')} type={channel === 'alipay' ? 'primary' : 'default'}>
            {t('billingNative.paymentChannel.alipay', 'Alipay')}
          </Button>
          <Button onClick={() => setChannel('wechat')} type={channel === 'wechat' ? 'primary' : 'default'}>
            {t('billingNative.paymentChannel.wechat', 'WeChat Pay')}
          </Button>
        </Flexbox>
        {createOrderError ? (
          <Text type={'danger'}>
            {t(
              'billingNative.plans.createOrderFailed',
              'Could not create the subscription order. Check payment configuration and try again.',
            )}
          </Text>
        ) : null}
        {createdOrder ? (
          <Flexbox className={styles.card} gap={8} padding={16}>
            <Text className={styles.cardLabel}>
              {t('billingNative.plans.pendingOrder', 'Pending subscription order')}
            </Text>
            <Text code>{createdOrder.order.id}</Text>
            <Text>{formatAmount(createdOrder.order.amountCents, createdOrder.order.currency)}</Text>
            {createdOrder.payment.qrCodeUrl || createdOrder.payment.paymentUrl ? (
              <a
                href={createdOrder.payment.qrCodeUrl ?? createdOrder.payment.paymentUrl}
                rel="noreferrer"
                target="_blank"
              >
                {t('billingNative.credits.topUp.openPayment', 'Open payment link')}
              </a>
            ) : null}
          </Flexbox>
        ) : null}
      </Flexbox>

      <Flexbox horizontal gap={12} wrap={'wrap'}>
        <Flexbox className={styles.card} flex={1} gap={12} padding={16}>
          <Flexbox gap={4}>
            <Text as={'h2'}>{t('billingNative.plans.free.name', 'Free')}</Text>
            <Text className={styles.subtitle}>
              {t('billingNative.plans.free.desc', 'Phone verification trial Credits')}
            </Text>
          </Flexbox>
          <Flexbox gap={4}>
            <Text className={styles.cardLabel}>
              {t('billingNative.plans.credits', 'Credits / month')}
            </Text>
            <CreditAmount size={'large'} value={FREE_TRIAL_CREDITS} />
          </Flexbox>
          <Text className={styles.subtitle}>
            {t('billingNative.plans.free.validity', 'One-time trial, valid for 30 days')}
          </Text>
          <Button disabled>
            {currentPlanId
              ? t('billingNative.plans.availableAfterExpiry', 'Available after current period')
              : t('billingNative.plans.current', 'Current Plan')}
          </Button>
        </Flexbox>

        {plans.map((plan) => {
          const planId = plan.id;
          if (!isSubscriptionPlanId(planId)) return null;

          const action = getPlanAction(planId, Boolean(plan.purchasable));
          const actionLabel =
            action === 'purchase'
              ? t('billingNative.plans.purchase', 'Purchase')
              : action === 'renew'
                ? t('billingNative.plans.renew', 'Renew')
                : action === 'upgrade'
                  ? t('billingNative.plans.upgrade', 'Upgrade')
                  : action === 'availableAfterExpiry'
                    ? t('billingNative.plans.availableAfterExpiry', 'Available after current period')
                    : t('billingNative.plans.purchaseUnavailable', 'Purchase unavailable');

          return (
            <Flexbox className={styles.card} flex={1} gap={12} key={planId} padding={16}>
              <Flexbox gap={4}>
                <Text as={'h2'}>{plan.name}</Text>
                <Text className={styles.subtitle}>
                  {t(
                    `billingNative.plans.plan.${planId}.desc`,
                    t('billingNative.plans.paidPlanDesc', 'Monthly managed model Credits'),
                  )}
                </Text>
              </Flexbox>
              <Flexbox gap={4}>
                <Text className={styles.cardLabel}>
                  {t('billingNative.plans.credits', 'Credits / month')}
                </Text>
                <CreditAmount size={'large'} value={plan.creditsPerMonth} />
              </Flexbox>
              <Flexbox gap={4}>
                <Text className={styles.cardLabel}>{t('billingNative.plans.price', 'Price')}</Text>
                <Text>
                  {formatAmount(plan.amountCents?.month ?? 0, plan.currency)} /{' '}
                  {t('billingNative.plans.period.monthShort', 'month')}
                </Text>
                <Text>
                  {formatAmount(plan.amountCents?.year ?? 0, plan.currency)} /{' '}
                  {t('billingNative.plans.period.yearShort', 'year')}
                </Text>
              </Flexbox>
              <Text className={styles.subtitle}>
                {t('billingNative.plans.currencyHint', '{{credits}} Credits billed in {{currency}}', {
                  credits: formatNumber(plan.creditsPerMonth),
                  currency: plan.currency,
                })}
              </Text>
              <Button
                disabled={action === 'availableAfterExpiry' || action === 'unavailable'}
                loading={isCreatingOrder === `${action}:${planId}`}
                onClick={() => void handleCreateOrder(planId, action)}
                type={'primary'}
              >
                {actionLabel}
              </Button>
            </Flexbox>
          );
        })}
      </Flexbox>
    </Flexbox>
  );
});

Plans.displayName = 'Plans';
export default Plans;
