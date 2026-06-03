'use client';

import { Button, Flexbox, Icon, Skeleton, Text } from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import type { LucideIcon } from 'lucide-react';
import {
  AtomIcon,
  CheckIcon,
  ChevronDownIcon,
  CircleHelpIcon,
  ExternalLinkIcon,
  SparklesIcon,
  ZapIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { billingService } from '@/services/billing';
import { formatNumber } from '@/utils/format';

import { useCurrentSubscription, useSubscriptionPlans } from './hooks/useBillingData';

const CLOUD_NAME = 'LobeHub Cloud';

type PaymentChannel = 'alipay' | 'wechat';
type PlanAction = 'availableAfterExpiry' | 'purchase' | 'renew' | 'unavailable' | 'upgrade';
type SubscriptionPlanId = 'starter' | 'premium' | 'ultimate';
type SubscriptionPeriod = 'month' | 'year';

interface CompareFeature {
  premium: string | true;
  starter: string | true;
  titleKey: string;
  ultimate: string | true;
}

interface CreatedSubscriptionOrder {
  order: Awaited<ReturnType<typeof billingService.createSubscriptionOrder>>['order'];
  payment: Awaited<ReturnType<typeof billingService.createSubscriptionOrder>>['payment'];
}

interface HeroPlan {
  accent: string;
  action: PlanAction;
  amountCents: number;
  badge?: string;
  credits: number;
  desc: string;
  icon: LucideIcon;
  id: SubscriptionPlanId;
  monthlyEquivalent: string;
  name: string;
  originalYearly: string;
  yearlyDiscount: string;
}

interface ModelAllowance {
  iconClassName: string;
  kind: 'image' | 'message';
  name: string;
  premium: string;
  starter: string;
  ultimate: string;
}

interface TranslateString {
  (key: string, fallback: string): unknown;
  (key: string, fallback: string, values: Record<string, string>): unknown;
}

const PLAN_RANK = {
  premium: 1,
  starter: 0,
  ultimate: 2,
} as const satisfies Record<SubscriptionPlanId, number>;

const MODEL_ALLOWANCES: ModelAllowance[] = [
  {
    iconClassName: 'deepseek',
    kind: 'message',
    name: 'DeepSeek V4 Pro',
    premium: '10,600',
    starter: '3,500',
    ultimate: '24,800',
  },
  {
    iconClassName: 'claude',
    kind: 'message',
    name: 'Claude Opus 4.8',
    premium: '500',
    starter: '200',
    ultimate: '1,300',
  },
  {
    iconClassName: 'gpt',
    kind: 'message',
    name: 'GPT-5.5',
    premium: '500',
    starter: '200',
    ultimate: '1,100',
  },
  {
    iconClassName: 'gemini',
    kind: 'message',
    name: 'Gemini 3.1 Pro Preview',
    premium: '1,200',
    starter: '400',
    ultimate: '2,800',
  },
  {
    iconClassName: 'gemini',
    kind: 'message',
    name: 'Gemini 3.1 Flash-Lite',
    premium: '9,400',
    starter: '3,200',
    ultimate: '22,400',
  },
  {
    iconClassName: 'nano',
    kind: 'image',
    name: 'Nano Banana 2',
    premium: '223',
    starter: '75',
    ultimate: '522',
  },
  {
    iconClassName: 'seedream',
    kind: 'image',
    name: 'Seedream 4.5',
    premium: '375',
    starter: '125',
    ultimate: '875',
  },
];

const MODEL_PRICE_ROWS = [
  ['DeepSeek V4 Pro', '0.435M', '0.87M'],
  ['DeepSeek V4 Flash', '0.14M', '0.28M'],
  ['Claude Sonnet 4.6', '3M', '15M'],
  ['Claude Opus 4.8', '5M', '25M'],
  ['Claude Haiku 4.5', '1M', '5M'],
  ['Gemini 3.1 Flash', '1.5M', '9M'],
  ['Gemini 3.1 Pro Preview', '2M', '12M'],
  ['Nano Banana 2', '3M', '12M'],
  ['GPT-5.5', '5M', '30M'],
  ['GPT-5.5 Pro', '30M', '180M'],
  ['Grok 4.3', '1.25M', '2.5M'],
  ['Kimi K2', '0.6M', '3M'],
  ['MiniMax M3', '0.6M', '2.4M'],
  ['Qwen3 Max', '2.5M', '7.5M'],
  ['GLM-4.6', '1M', '3.2M'],
  ['MM-V2.5', '0.14M', '0.28M'],
] as const;

const COMPARE_GROUPS: { features: CompareFeature[]; title: string }[] = [
  {
    features: [
      {
        premium: '15,000,000',
        starter: '5,000,000',
        titleKey: 'billingNative.plans.pixelCompare.monthlyCredits',
        ultimate: '35,000,000',
      },
      {
        premium: true,
        starter: true,
        titleKey: 'billingNative.plans.pixelCompare.hostedModels',
        ultimate: true,
      },
      {
        premium: true,
        starter: true,
        titleKey: 'billingNative.plans.pixelCompare.modelApi',
        ultimate: true,
      },
    ],
    title: 'plans.credit.title',
  },
  {
    features: [
      {
        premium: true,
        starter: true,
        titleKey: 'billingNative.plans.pixelCompare.filesKnowledgeBase',
        ultimate: true,
      },
      {
        premium: '2.0 GB',
        starter: '1.0 GB',
        titleKey: 'plans.fileStorage.title',
        ultimate: '4.0 GB',
      },
      {
        premium: '10,000',
        starter: '5,000',
        titleKey: 'plans.embeddingStorage.title',
        ultimate: '20,000',
      },
    ],
    title: 'billingNative.plans.pixelCompare.fileManagement',
  },
  {
    features: [
      {
        premium: true,
        starter: true,
        titleKey: 'billingNative.plans.pixelCompare.multiAgent',
        ultimate: true,
      },
      {
        premium: true,
        starter: true,
        titleKey: 'billingNative.plans.pixelCompare.writing',
        ultimate: true,
      },
      {
        premium: true,
        starter: true,
        titleKey: 'plans.features.internet',
        ultimate: true,
      },
    ],
    title: 'plans.features.title',
  },
];

const FAQ_KEYS = ['free', 'credit', 'limit', 'highUsage', 'management', 'embeddings'] as const;

const styles = createStaticStyles(({ css, cssVar: token }) => ({
  allowanceItem: css`
    display: grid;
    grid-template-columns: 18px 1fr;
    gap: 8px 14px;
    align-items: flex-start;

    font-size: 14px;
    line-height: 1.5;
  `,
  answer: css`
    max-width: 640px;
    font-size: 12px;
    line-height: 1.7;
    color: ${token.colorTextSecondary};
  `,
  billingToggle: css`
    display: grid;
    grid-template-columns: 1fr 1fr 1.35fr;
    align-items: center;

    width: 364px;
    height: 40px;
    padding: 2px;
    border-radius: 14px;

    background: ${token.colorFillQuaternary};

    @media (width <= 640px) {
      width: 100%;
    }
  `,
  channelIcon: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;

    width: 16px;
    height: 16px;
    border-radius: 5px;

    font-size: 11px;
    font-weight: 800;
    color: #fff;
  `,
  compareCell: css`
    min-height: 42px;
    padding-block: 14px;
    border-block-end: 1px solid ${token.colorBorderSecondary};

    font-size: 12px;
    color: ${token.colorText};
    text-align: center;
  `,
  compareGrid: css`
    display: grid;
    grid-template-columns: minmax(180px, 1fr) repeat(3, minmax(150px, 1fr));
    width: 100%;

    @media (width <= 900px) {
      overflow-x: auto;
      grid-template-columns: 180px repeat(3, 170px);
    }
  `,
  compareHeader: css`
    position: sticky;
    z-index: 1;
    inset-block-start: 0;

    padding-block: 0 12px;

    background: ${token.colorBgLayout};
  `,
  compareHeaderCard: css`
    gap: 6px;
    align-items: center;
    padding-inline: 10px;
  `,
  compareTitleCell: css`
    min-height: 42px;
    padding-block: 14px;
    border-block-end: 1px solid ${token.colorBorderSecondary};

    font-size: 12px;
    color: ${token.colorTextSecondary};
  `,
  faqItem: css`
    overflow: hidden;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 6px;
    background: ${token.colorBgContainer};
  `,
  faqQuestion: css`
    width: 100%;
    padding-block: 12px;
    padding-inline: 14px;
    border: 0;

    color: ${token.colorText};
    text-align: start;

    background: transparent;
  `,
  featureSection: css`
    border-block-end: 1px solid ${token.colorBorderSecondary};
    font-size: 13px;
    font-weight: 600;
  `,
  heroCard: css`
    position: relative;

    overflow: hidden;
    justify-content: space-between;

    min-width: 0;
    min-height: 525px;
    padding: 28px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 8px;

    background: ${token.colorBgContainer};

    transition:
      border-color 180ms ease,
      box-shadow 180ms ease,
      transform 180ms ease;

    &:hover {
      transform: translateY(-2px);
      border-color: ${token.colorBorder};
      box-shadow: ${token.boxShadowTertiary};
    }
  `,
  heroCards: css`
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 20px;

    @media (width <= 960px) {
      grid-template-columns: 1fr;
    }
  `,
  iconBadge: css`
    width: 38px;
    height: 38px;
    border-radius: 12px;
    box-shadow: inset 0 0 0 2px rgb(255 255 255 / 65%);
  `,
  modelIcon: css`
    width: 12px;
    height: 12px;
    border-radius: 999px;

    &[data-kind='deepseek'] {
      background: #4f7cff;
    }

    &[data-kind='claude'] {
      background: #f07f57;
    }

    &[data-kind='gpt'] {
      background: #ff73a8;
    }

    &[data-kind='gemini'] {
      background: #4f8cff;
    }

    &[data-kind='nano'] {
      background: #f1c232;
    }

    &[data-kind='seedream'] {
      background: #111;
    }
  `,
  page: css`
    width: 100%;
    max-width: 1320px;
    margin-inline: auto;
    padding-block: 28px 88px;

    color: ${token.colorText};
  `,
  pageDivider: css`
    height: 1px;
    margin-block: 28px 48px;
    background: ${token.colorBorderSecondary};
  `,
  paymentBadge: css`
    gap: 6px;
    align-items: center;
    font-size: 15px;
    color: ${token.colorTextSecondary};
  `,
  planButton: css`
    height: 40px;
    border-radius: 8px;

    font-size: 15px;
    font-weight: 700;

    background: #1f1f1f !important;
    box-shadow: none !important;

    &:hover {
      background: #000 !important;
    }
  `,
  planName: css`
    margin-block: 18px 8px;
    font-size: 19px;
    font-weight: 800;
    line-height: 1.25;
  `,
  price: css`
    margin-block-start: 26px;
    font-size: 30px;
    font-weight: 800;
    letter-spacing: 0;
  `,
  priceCaption: css`
    font-size: 14px;
    color: ${token.colorTextSecondary};
  `,
  priceTable: css`
    border-collapse: collapse;
    width: 100%;

    th,
    td {
      height: 34px;
      padding-inline: 10px;
      border-block-end: 1px solid ${token.colorBorderSecondary};

      font-size: 12px;
      text-align: start;
      white-space: nowrap;
    }

    th {
      font-weight: 500;
      color: ${token.colorTextTertiary};
    }
  `,
  priceTablePanel: css`
    overflow: hidden;

    width: min(480px, 100%);
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 8px;

    background: ${token.colorBgContainer};
  `,
  sectionTitle: css`
    font-size: 16px;
    font-weight: 800;
  `,
  supportButton: css`
    min-width: 108px;
    height: 28px;
    border-radius: 6px;
    font-size: 12px;
  `,
  toggleButton: css`
    height: 36px;
    border: 0 !important;
    border-radius: 12px;

    color: ${token.colorTextSecondary};

    background: transparent !important;
    box-shadow: none !important;

    &[data-active='true'] {
      color: ${token.colorText};
      background: ${token.colorBgContainer} !important;
      box-shadow: ${token.boxShadowTertiary} !important;
    }
  `,
}));

const isSubscriptionPlanId = (value: string): value is SubscriptionPlanId => value in PLAN_RANK;

const formatAmount = (amountCents: number, currency = 'CNY') =>
  `${currency} ${(amountCents / 100).toLocaleString('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`;

const getPlanAccent = (planId: SubscriptionPlanId) => {
  if (planId === 'starter') return '#b56a32';
  if (planId === 'premium') return '#7f95a5';

  return '#d29b12';
};

const getPlanIcon = (planId: SubscriptionPlanId) => {
  if (planId === 'starter') return SparklesIcon;
  if (planId === 'premium') return ZapIcon;

  return AtomIcon;
};

const getFallbackYearlyMeta = (planId: SubscriptionPlanId) => {
  if (planId === 'starter')
    return { monthlyEquivalent: '$9.9', originalYearly: '$118.8', yearlyDiscount: '23%' };
  if (planId === 'premium')
    return { monthlyEquivalent: '$19.9', originalYearly: '$238.8', yearlyDiscount: '20%' };

  return { monthlyEquivalent: '$39.9', originalYearly: '$478.8', yearlyDiscount: '20%' };
};

const translateString = (
  t: TranslateString,
  key: string,
  fallback: string,
  values?: Record<string, string>,
) => {
  const result = values ? t(key, fallback, values) : t(key, fallback);

  return typeof result === 'string' ? result : fallback;
};

const renderCompareValue = (
  value: string | true,
  t: TranslateString,
  unitKey?: string,
): ReactNode =>
  value === true ? (
    <Icon color="#29a34a" icon={CheckIcon} size={14} />
  ) : unitKey ? (
    translateString(t, unitKey, value, { amount: value })
  ) : (
    value
  );

const Plans = memo(() => {
  const { t } = useTranslation('subscription');
  const { data, isLoading } = useSubscriptionPlans();
  const { data: currentSubscription, isLoading: isCurrentSubscriptionLoading } =
    useCurrentSubscription();
  const [channel, setChannel] = useState<PaymentChannel>('alipay');
  const [createdOrder, setCreatedOrder] = useState<CreatedSubscriptionOrder>();
  const [createOrderError, setCreateOrderError] = useState<string>();
  const [isCreatingOrder, setIsCreatingOrder] = useState<string>();
  const [period, setPeriod] = useState<SubscriptionPeriod>('year');

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

  const planCards: HeroPlan[] = plans.flatMap((plan) => {
    const planId = plan.id;
    if (!isSubscriptionPlanId(planId)) return [];

    const yearlyMeta = getFallbackYearlyMeta(planId);

    return [
      {
        accent: getPlanAccent(planId),
        action: getPlanAction(planId, Boolean(plan.purchasable)),
        amountCents: plan.amountCents?.[period] ?? 0,
        badge:
          planId === 'premium'
            ? t('billingNative.plans.pixel.badge.popular', 'Most Popular')
            : undefined,
        credits: plan.creditsPerMonth,
        desc: t(
          `billingNative.plans.plan.${planId}.desc`,
          t('billingNative.plans.paidPlanDesc', 'Monthly managed model Credits'),
        ),
        icon: getPlanIcon(planId),
        id: planId,
        monthlyEquivalent: yearlyMeta.monthlyEquivalent,
        name: t(`plans.plan.${planId}.title`, plan.name),
        originalYearly: yearlyMeta.originalYearly,
        yearlyDiscount: yearlyMeta.yearlyDiscount,
      },
    ];
  });

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
            : await billingService.createSubscriptionUpgradeOrder({
                channel,
                targetPlanId: planId,
              });
      setCreatedOrder(result);
    } catch (error) {
      setCreateOrderError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsCreatingOrder(undefined);
    }
  };

  const getActionLabel = (action: PlanAction) => {
    if (action === 'purchase') return t('billingNative.plans.purchase', 'Purchase');
    if (action === 'renew') return t('billingNative.plans.renew', 'Renew');
    if (action === 'upgrade') return t('billingNative.plans.upgrade', 'Upgrade');
    if (action === 'availableAfterExpiry')
      return t('billingNative.plans.availableAfterExpiry', 'Available after current period');

    return t('billingNative.plans.purchaseUnavailable', 'Purchase unavailable');
  };

  const formatAllowance = (item: ModelAllowance, planId: SubscriptionPlanId) => {
    const amount =
      planId === 'starter' ? item.starter : planId === 'premium' ? item.premium : item.ultimate;
    const key =
      item.kind === 'image'
        ? 'billingNative.plans.pixel.approxImages'
        : 'billingNative.plans.pixel.approxMessages';

    return t(key, { amount });
  };

  return (
    <Flexbox className={styles.page} gap={44}>
      <Flexbox>
        <Text as={'h1'} fontSize={28} weight={800}>
          {t('billingNative.plans.title', 'Plans')}
        </Text>
        <div className={styles.pageDivider} />
        <Flexbox align={'center'}>
          <div className={styles.billingToggle}>
            <Button
              className={styles.toggleButton}
              data-active={period === 'year'}
              type={'text'}
              onClick={() => setPeriod('year')}
            >
              {t('billingNative.plans.pixel.period.yearly', 'Yearly')}
              <Text
                as={'span'}
                style={{
                  background: 'rgb(236 253 236)',
                  borderRadius: 5,
                  color: '#28a745',
                  marginInlineStart: 8,
                  paddingBlock: 2,
                  paddingInline: 6,
                }}
              >
                {t('billingNative.plans.pixel.discount.max', { percent: '37%' })}
              </Text>
            </Button>
            <Button
              className={styles.toggleButton}
              data-active={period === 'month'}
              type={'text'}
              onClick={() => setPeriod('month')}
            >
              {t('billingNative.plans.pixel.period.monthly', 'Monthly')}
            </Button>
            <Flexbox horizontal className={styles.paymentBadge}>
              <span>{t('billingNative.plans.pixel.payOnce', 'One-time')}</span>
              <button
                aria-label={t('billingNative.paymentChannel.alipay', 'Alipay')}
                className={styles.channelIcon}
                style={{ background: '#14a8f5' }}
                type="button"
                onClick={() => setChannel('alipay')}
              >
                {t('billingNative.plans.pixel.payment.alipayMark', 'Ali')}
              </button>
              <button
                aria-label={t('billingNative.paymentChannel.wechat', 'WeChat Pay')}
                className={styles.channelIcon}
                style={{ background: '#08bf22' }}
                type="button"
                onClick={() => setChannel('wechat')}
              >
                ✓
              </button>
            </Flexbox>
          </div>
        </Flexbox>
      </Flexbox>

      <div className={styles.heroCards}>
        {planCards.map((plan) => (
          <Flexbox className={styles.heroCard} gap={22} key={plan.id}>
            <Flexbox gap={14}>
              <Flexbox horizontal align={'center'} justify={'space-between'}>
                <Flexbox
                  align={'center'}
                  className={styles.iconBadge}
                  justify={'center'}
                  style={{ background: plan.accent, color: '#fff' }}
                >
                  <Icon icon={plan.icon} size={22} />
                </Flexbox>
                {plan.badge ? (
                  <Text
                    as={'span'}
                    style={{
                      border: '1px solid rgb(255 231 186 / 72%)',
                      borderRadius: 999,
                      color: '#fa8c16',
                      paddingBlock: 4,
                      paddingInline: 12,
                    }}
                  >
                    {plan.badge}
                  </Text>
                ) : null}
              </Flexbox>
              <Flexbox>
                <Text className={styles.planName}>{plan.name}</Text>
                <Text color={cssVar.colorTextSecondary} fontSize={15}>
                  {plan.desc}
                </Text>
              </Flexbox>
              <Flexbox>
                <Text className={styles.price}>
                  {period === 'year'
                    ? plan.monthlyEquivalent
                    : formatAmount(plan.amountCents).replace('CNY ', '¥')}
                  <Text as={'span'} fontSize={15} weight={600}>
                    {' '}
                    {t(
                      period === 'year'
                        ? 'billingNative.plans.pixel.price.perMonthYearly'
                        : 'billingNative.plans.pixel.price.perMonth',
                    )}
                  </Text>
                </Text>
                {period === 'year' ? (
                  <Flexbox horizontal align={'center'} gap={8}>
                    <Text className={styles.priceCaption}>
                      {t('billingNative.plans.pixel.price.perYear', {
                        price: plan.originalYearly,
                      })}
                    </Text>
                    <Text
                      as={'span'}
                      style={{
                        background: 'rgb(236 253 236)',
                        borderRadius: 5,
                        color: '#28a745',
                        paddingBlock: 2,
                        paddingInline: 7,
                      }}
                    >
                      {t('billingNative.plans.pixel.discount.short', {
                        percent: plan.yearlyDiscount,
                      })}
                    </Text>
                  </Flexbox>
                ) : null}
              </Flexbox>
              <Button
                className={styles.planButton}
                disabled={plan.action === 'availableAfterExpiry' || plan.action === 'unavailable'}
                loading={isCreatingOrder === `${plan.action}:${plan.id}`}
                type={'primary'}
                onClick={() => void handleCreateOrder(plan.id, plan.action)}
              >
                {getActionLabel(plan.action)}
              </Button>
            </Flexbox>

            <Flexbox gap={16}>
              <Flexbox gap={4}>
                <Flexbox horizontal align={'center'} gap={5}>
                  <Text color={cssVar.colorTextSecondary} fontSize={15}>
                    {t('plans.credit.title', 'Credits')}
                  </Text>
                  <Icon color={cssVar.colorTextTertiary} icon={CircleHelpIcon} size={14} />
                </Flexbox>
                <Text fontSize={16}>
                  {t('billingNative.plans.pixel.perMonthAmount', {
                    amount: formatNumber(plan.credits),
                  })}
                </Text>
              </Flexbox>
              {MODEL_ALLOWANCES.slice(0, 4).map((item) => (
                <div className={styles.allowanceItem} key={`${plan.id}-${item.name}`}>
                  <Icon color="#2ba84a" icon={CheckIcon} size={14} />
                  <Flexbox gap={4}>
                    <Flexbox horizontal align={'center'} gap={5}>
                      <Text color={cssVar.colorTextSecondary} fontSize={15}>
                        {item.name}
                      </Text>
                      <Icon color={cssVar.colorTextTertiary} icon={CircleHelpIcon} size={13} />
                    </Flexbox>
                    <Text fontSize={15}>{formatAllowance(item, plan.id)}</Text>
                  </Flexbox>
                </div>
              ))}
            </Flexbox>
          </Flexbox>
        ))}
      </div>

      {createOrderError ? (
        <Text type={'danger'}>
          {t(
            'billingNative.plans.createOrderFailed',
            'Could not create the subscription order. Check payment configuration and try again.',
          )}
        </Text>
      ) : null}

      {createdOrder ? (
        <Flexbox
          gap={8}
          padding={16}
          style={{ border: `1px solid ${cssVar.colorBorderSecondary}`, borderRadius: 8 }}
        >
          <Text weight={700}>
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
              <Flexbox horizontal align={'center'} gap={6}>
                {t('billingNative.credits.topUp.openPayment', 'Open payment link')}
                <Icon icon={ExternalLinkIcon} size={14} />
              </Flexbox>
            </a>
          ) : null}
        </Flexbox>
      ) : null}

      <Flexbox horizontal align={'flex-start'} gap={44} wrap={'wrap'}>
        <Flexbox flex={1} gap={12} style={{ minWidth: 280 }}>
          <Text className={styles.sectionTitle}>{t('modelPricing.title')}</Text>
          <Text color={cssVar.colorTextSecondary} fontSize={12}>
            {t('modelPricing.desc', { name: CLOUD_NAME })}
          </Text>
          <Button className={styles.supportButton}>{t('modelPricing.button')}</Button>
        </Flexbox>
        <div className={styles.priceTablePanel}>
          <table className={styles.priceTable}>
            <thead>
              <tr>
                <th>{t('models.title')}</th>
                <th>{t('models.input')}</th>
                <th>{t('models.output')}</th>
              </tr>
            </thead>
            <tbody>
              {MODEL_PRICE_ROWS.map(([name, input, output], index) => (
                <tr key={name}>
                  <td>
                    <Flexbox horizontal align={'center'} gap={8}>
                      <span
                        className={styles.modelIcon}
                        data-kind={
                          index < 2
                            ? 'deepseek'
                            : name.includes('Claude')
                              ? 'claude'
                              : name.includes('GPT')
                                ? 'gpt'
                                : name.includes('Gemini')
                                  ? 'gemini'
                                  : name.includes('Nano')
                                    ? 'nano'
                                    : 'seedream'
                        }
                      />
                      {name}
                    </Flexbox>
                  </td>
                  <td>{input}</td>
                  <td>{output}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Flexbox>

      <Flexbox gap={18}>
        <Text className={styles.sectionTitle}>{t('compare.title')}</Text>
        <div className={styles.compareGrid}>
          <div className={styles.compareHeader} />
          {planCards.map((plan) => (
            <Flexbox className={styles.compareHeader} key={`header-${plan.id}`}>
              <Flexbox className={styles.compareHeaderCard}>
                <Flexbox horizontal align={'center'} gap={8}>
                  <Flexbox
                    align={'center'}
                    className={styles.iconBadge}
                    justify={'center'}
                    style={{ background: plan.accent, color: '#fff', height: 26, width: 26 }}
                  >
                    <Icon icon={plan.icon} size={15} />
                  </Flexbox>
                  <Flexbox>
                    <Text fontSize={13} weight={700}>
                      {plan.name}
                    </Text>
                    <Text color={cssVar.colorTextTertiary} fontSize={10}>
                      {t('billingNative.plans.pixel.price.perMonthYearlyWithPrice', {
                        price: plan.monthlyEquivalent,
                      })}
                    </Text>
                  </Flexbox>
                </Flexbox>
                <Button
                  className={styles.planButton}
                  disabled={plan.action === 'availableAfterExpiry' || plan.action === 'unavailable'}
                  size={'small'}
                  type={'primary'}
                  onClick={() => void handleCreateOrder(plan.id, plan.action)}
                >
                  {getActionLabel(plan.action)}
                </Button>
              </Flexbox>
            </Flexbox>
          ))}

          {COMPARE_GROUPS.map((group) => (
            <MemoCompareGroup group={group} key={group.title} t={t} />
          ))}

          {MODEL_ALLOWANCES.map((item) => (
            <MemoCompareAllowance item={item} key={item.name} t={t} />
          ))}
        </div>
      </Flexbox>

      <Flexbox horizontal align={'flex-start'} gap={44} wrap={'wrap'}>
        <Flexbox gap={10} style={{ width: 250 }}>
          <Text className={styles.sectionTitle}>{t('qa.title', 'FAQ')}</Text>
          <Text color={cssVar.colorTextSecondary} fontSize={12}>
            {t('billingNative.plans.pixel.qa.desc')}
          </Text>
          <Flexbox horizontal gap={8}>
            <Button className={styles.supportButton}>{t('qa.support.community')}</Button>
            <Button className={styles.supportButton}>{t('qa.support.email')}</Button>
          </Flexbox>
        </Flexbox>
        <Flexbox flex={1} gap={8} style={{ minWidth: 300 }}>
          {FAQ_KEYS.map((key) => (
            <details className={styles.faqItem} key={key} open={key === 'free'}>
              <summary className={styles.faqQuestion}>
                <Flexbox horizontal align={'center'} justify={'space-between'}>
                  <Text fontSize={13} weight={700}>
                    {t(`qa.list.${key}.q`, key)}
                  </Text>
                  <Icon color={cssVar.colorTextTertiary} icon={ChevronDownIcon} size={14} />
                </Flexbox>
              </summary>
              <Flexbox
                className={styles.answer}
                paddingBlock={0}
                paddingInline={14}
                style={{ paddingBottom: 12 }}
              >
                {t(`qa.list.${key}.a`, '', {
                  cloud: CLOUD_NAME,
                  credit: '500,000',
                  funds: t('tab.credits', 'Credits'),
                  management: t('tab.billing', 'Billing'),
                  name: 'LobeHub',
                  premium: t('plans.plan.premium.title', 'Premium'),
                  starter: t('plans.plan.starter.title', 'Starter'),
                  subscribe: t('tab.plans', 'Plans'),
                  ultimate: t('plans.plan.ultimate.title', 'Ultimate'),
                  usage: t('tab.usage', 'Usage'),
                })}
              </Flexbox>
            </details>
          ))}
        </Flexbox>
      </Flexbox>
    </Flexbox>
  );
});

const getCompareValueUnitKey = (titleKey: string) => {
  if (titleKey === 'billingNative.plans.pixelCompare.monthlyCredits')
    return 'billingNative.plans.pixel.perMonthAmount';
  if (titleKey === 'plans.embeddingStorage.title') return 'plans.embeddingStorage.entries';

  return undefined;
};

const MemoCompareGroup = memo<{
  group: (typeof COMPARE_GROUPS)[number];
  t: TranslateString;
}>(({ group, t }) => (
  <>
    <Flexbox className={styles.featureSection} paddingBlock={16}>
      {translateString(t, group.title, group.title)}
    </Flexbox>
    <div />
    <div />
    <div />
    {group.features.map((feature) => (
      <MemoCompareFeature
        feature={feature}
        key={feature.titleKey}
        t={t}
        unitKey={getCompareValueUnitKey(feature.titleKey)}
      />
    ))}
  </>
));

MemoCompareGroup.displayName = 'MemoCompareGroup';

const MemoCompareFeature = memo<{
  feature: CompareFeature;
  t: TranslateString;
  unitKey?: string;
}>(({ feature, t, unitKey }) => (
  <>
    <Flexbox className={styles.compareTitleCell}>
      {translateString(t, feature.titleKey, feature.titleKey)}
    </Flexbox>
    <Flexbox align={'center'} className={styles.compareCell} justify={'center'}>
      {renderCompareValue(feature.starter, t, unitKey)}
    </Flexbox>
    <Flexbox align={'center'} className={styles.compareCell} justify={'center'}>
      {renderCompareValue(feature.premium, t, unitKey)}
    </Flexbox>
    <Flexbox align={'center'} className={styles.compareCell} justify={'center'}>
      {renderCompareValue(feature.ultimate, t, unitKey)}
    </Flexbox>
  </>
));

MemoCompareFeature.displayName = 'MemoCompareFeature';

const MemoCompareAllowance = memo<{
  item: ModelAllowance;
  t: TranslateString;
}>(({ item, t }) => {
  const key =
    item.kind === 'image'
      ? 'billingNative.plans.pixel.approxImages'
      : 'billingNative.plans.pixel.approxMessages';

  return (
    <>
      <Flexbox className={styles.compareTitleCell}>
        <Flexbox horizontal align={'center'} gap={8}>
          <span className={styles.modelIcon} data-kind={item.iconClassName} />
          {item.name}
        </Flexbox>
      </Flexbox>
      <Flexbox align={'center'} className={styles.compareCell} justify={'center'}>
        {translateString(t, key, item.starter, { amount: item.starter })}
      </Flexbox>
      <Flexbox align={'center'} className={styles.compareCell} justify={'center'}>
        {translateString(t, key, item.premium, { amount: item.premium })}
      </Flexbox>
      <Flexbox align={'center'} className={styles.compareCell} justify={'center'}>
        {translateString(t, key, item.ultimate, { amount: item.ultimate })}
      </Flexbox>
    </>
  );
});

MemoCompareAllowance.displayName = 'MemoCompareAllowance';

Plans.displayName = 'Plans';
export default Plans;
