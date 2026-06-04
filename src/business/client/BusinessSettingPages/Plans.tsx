'use client';

import { ModelIcon } from '@lobehub/icons';
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

import {
  useCurrentSubscription,
  useSubscriptionPlans,
  useTextModelPricing,
} from './hooks/useBillingData';

const CLOUD_NAME = 'LobeHub Cloud';

type PaymentChannel = 'alipay' | 'wechat';
type PlanAction = 'availableAfterExpiry' | 'purchase' | 'renew' | 'unavailable' | 'upgrade';
type BillingMode = 'month' | 'oneTime' | 'year';
type OneTimeDuration = 'halfYear' | 'month' | 'quarter' | 'year';
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
  monthlyPrice: string;
  name: string;
  oneTimeOptions: OneTimeOption[];
  originalYearly: string;
  yearlyDiscount: string;
}

interface OneTimeOption {
  discount?: string;
  labelKey: string;
  period: SubscriptionPeriod;
  price: string;
  value: OneTimeDuration;
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

const DISPLAY_PRICE_META = {
  premium: {
    monthlyPrice: '$24.9',
    oneTimeOptions: [
      { labelKey: 'recurring.oneMonth', period: 'month', price: '$24.9', value: 'month' },
      { labelKey: 'recurring.threeMonth', period: 'month', price: '$74.7', value: 'quarter' },
      { labelKey: 'recurring.sixMonth', period: 'month', price: '$149.4', value: 'halfYear' },
      {
        discount: '20%',
        labelKey: 'recurring.oneYear',
        period: 'year',
        price: '$238.8',
        value: 'year',
      },
    ],
    originalYearly: '$238.8',
    yearlyDiscount: '20%',
    yearlyMonthly: '$19.9',
  },
  starter: {
    monthlyPrice: '$12.9',
    oneTimeOptions: [
      { labelKey: 'recurring.oneMonth', period: 'month', price: '$12.9', value: 'month' },
      { labelKey: 'recurring.threeMonth', period: 'month', price: '$38.7', value: 'quarter' },
      { labelKey: 'recurring.sixMonth', period: 'month', price: '$77.4', value: 'halfYear' },
      {
        discount: '23%',
        labelKey: 'recurring.oneYear',
        period: 'year',
        price: '$118.8',
        value: 'year',
      },
    ],
    originalYearly: '$118.8',
    yearlyDiscount: '23%',
    yearlyMonthly: '$9.9',
  },
  ultimate: {
    monthlyPrice: '$49.9',
    oneTimeOptions: [
      { labelKey: 'recurring.oneMonth', period: 'month', price: '$49.9', value: 'month' },
      { labelKey: 'recurring.threeMonth', period: 'month', price: '$149.7', value: 'quarter' },
      { labelKey: 'recurring.sixMonth', period: 'month', price: '$299.4', value: 'halfYear' },
      {
        discount: '20%',
        labelKey: 'recurring.oneYear',
        period: 'year',
        price: '$478.8',
        value: 'year',
      },
    ],
    originalYearly: '$478.8',
    yearlyDiscount: '20%',
    yearlyMonthly: '$39.9',
  },
} as const satisfies Record<
  SubscriptionPlanId,
  {
    monthlyPrice: string;
    oneTimeOptions: OneTimeOption[];
    originalYearly: string;
    yearlyDiscount: string;
    yearlyMonthly: string;
  }
>;

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

const PLAN_FEATURE_GROUPS = [
  {
    itemKeys: ['plans.llm.customAPI', 'plans.llm.messageRequest'],
    titleKey: 'plans.llm.title',
    tooltip: true,
  },
  {
    itemKeys: ['plans.cloud.history', 'plans.cloud.sync'],
    titleKey: 'plans.cloud.title',
  },
  {
    itemKeys: ['plans.features.agents', 'plans.features.plugins', 'plans.features.internet'],
    titleKey: 'plans.features.title',
  },
] as const;

const PLAN_SUPPORT_KEYS = {
  premium: 'plans.support.premium',
  starter: 'plans.support.starter',
  ultimate: 'plans.support.ultimate',
} as const satisfies Record<SubscriptionPlanId, string>;

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
    grid-template-columns: 1.25fr 1fr 1.05fr;
    align-items: center;

    width: 528px;
    height: 60px;
    padding: 3px;
    border-radius: 13px;

    background: ${token.colorFillSecondary};

    @media (width <= 640px) {
      width: 100%;
    }
  `,
  buttonSlot: css`
    margin-block-start: 16px;
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
  discountBadge: css`
    border-radius: 5px;
    color: #1fa23b;
    background: #e9fbe8;
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
    flex: 0 0 var(--plan-card-width, calc((100% - 24px) / 3));

    min-width: 0;
    max-width: 100%;
    min-height: 1220px;
    padding-block: 22px 16px;
    padding-inline: 20px;
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
    display: flex;
    flex-wrap: wrap;
    gap: 12px;

    @media (width <= 1140px) {
      --plan-card-width: calc((100% - 12px) / 2);
    }

    @media (width <= 720px) {
      --plan-card-width: 100%;
    }
  `,
  iconBadge: css`
    width: 34px;
    height: 34px;
    border-radius: 12px;
    box-shadow: inset 0 0 0 2px rgb(255 255 255 / 65%);
  `,
  benefits: css`
    margin-block-start: 32px;
  `,
  benefitGroup: css`
    gap: 14px;
    margin-block-start: 26px;
  `,
  benefitGroupTitle: css`
    font-size: 16px;
    font-weight: 700;
    color: ${token.colorTextSecondary};
  `,
  benefitItem: css`
    display: grid;
    grid-template-columns: 18px 1fr;
    gap: 12px;
    align-items: center;

    font-size: 16px;
    line-height: 1.45;
  `,
  supportText: css`
    font-size: 16px;
    line-height: 1.45;
  `,
  oneTimePayment: css`
    font-size: 13px;
    color: ${token.colorTextTertiary};
  `,
  oneTimeSelect: css`
    position: relative;
    display: block;
    width: 100%;
  `,
  oneTimeSelectButton: css`
    display: grid;
    grid-template-columns: 1fr 18px;
    align-items: center;

    width: 100%;
    height: 52px;
    padding-inline: 12px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 7px;

    color: ${token.colorText};
    text-align: start;

    background: ${token.colorBgContainer};
    box-shadow: none;
  `,
  oneTimeSelectMenu: css`
    position: absolute;
    z-index: 3;
    inset-block-start: 58px;
    inset-inline: 0;

    overflow: hidden;

    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 8px;

    background: ${token.colorBgElevated};
    box-shadow: 0 16px 34px rgb(0 0 0 / 10%);
  `,
  oneTimeSelectOption: css`
    display: flex;
    align-items: center;

    width: 100%;
    min-height: 52px;
    padding-inline: 12px;
    border: 0;

    color: ${token.colorText};
    text-align: start;

    background: transparent;

    &[data-active='true'] {
      background: ${token.colorFillSecondary};
    }
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
    max-width: 1360px;
    margin-inline: auto;
    padding-block: 30px 88px;

    color: ${token.colorText};
  `,
  pageDivider: css`
    height: 1px;
    margin-block: 26px 36px;
    background: ${token.colorBorderSecondary};
  `,
  paymentBadge: css`
    gap: 4px;
    align-items: center;
    font-size: 15px;
  `,
  planIntro: css`
    min-height: 154px;
  `,
  planPurchase: css`
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    min-height: 168px;
  `,
  planButton: css`
    width: 100%;
    height: 48px;
    border-radius: 8px;

    font-size: 16px;
    font-weight: 700;

    background: #1f1f1f !important;
    box-shadow: none !important;

    &:hover {
      background: #000 !important;
    }
  `,
  planName: css`
    margin-block: 22px 8px;
    font-size: 18px;
    font-weight: 800;
    line-height: 1.25;
  `,
  price: css`
    font-size: clamp(26px, 2.2vw, 31px);
    font-weight: 800;
    letter-spacing: 0;
    white-space: nowrap;
  `,
  priceLine: css`
    display: inline-flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: baseline;

    white-space: nowrap;
  `,
  priceCaption: css`
    font-size: 14px;
  `,
  priceDocsButton: css`
    width: min(100%, 300px);
    height: 44px;
    border-radius: 8px;
  `,
  priceLayout: css`
    display: grid;
    grid-template-columns: minmax(260px, 360px) minmax(0, 1fr);
    gap: clamp(28px, 4vw, 70px);
    align-items: flex-start;

    @media (width <= 1180px) {
      grid-template-columns: 1fr;
      gap: 24px;
    }
  `,
  priceSectionTitle: css`
    font-size: 24px;
    font-weight: 800;
  `,
  priceTable: css`
    table-layout: fixed;
    border-collapse: collapse;

    th,
    td {
      height: 62px;
      padding-inline: clamp(12px, 1.4vw, 24px);
      border-block-end: 1px solid ${token.colorBorderSecondary};
      text-align: start;
    }

    th {
      position: sticky;
      z-index: 1;
      inset-block-start: 0;

      height: 56px;

      font-size: 16px;
      font-weight: 800;
      color: ${token.colorText};
      white-space: nowrap;

      background: ${token.colorBgContainer};
      box-shadow: inset 0 -1px ${token.colorBorderSecondary};
    }

    th:nth-child(2),
    th:nth-child(3),
    td:nth-child(2),
    td:nth-child(3) {
      text-align: end;
    }

    tbody tr:last-child td {
      border-block-end: 0;
    }
  `,
  priceTablePanel: css`
    container: pricing-table / inline-size;
    overflow: hidden auto;

    width: 100%;
    max-height: min(760px, 72vh);
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 8px;

    background: ${token.colorBgContainer};
  `,
  priceTableRate: css`
    display: inline-flex;
    gap: 8px;
    align-items: center;
    justify-content: flex-end;

    min-width: 0;

    font-size: 17px;
    font-weight: 800;
    line-height: 1;
    white-space: nowrap;
  `,
  priceTableUnit: css`
    padding-block: 3px;
    padding-inline: 8px;
    border-radius: 5px;

    font-size: 14px;
    font-weight: 500;
    color: ${token.colorTextSecondary};

    background: ${token.colorFillQuaternary};
  `,
  priceTokenBadge: css`
    margin-inline-start: 8px;
    padding-block: 3px;
    padding-inline: 8px;
    border-radius: 5px;

    font-size: 14px;
    font-weight: 700;
    color: ${token.colorTextSecondary};

    background: ${token.colorFillQuaternary};
  `,
  pricingModelName: css`
    overflow: hidden;

    min-width: 0;

    font-size: 17px;
    line-height: 1.35;
    text-overflow: ellipsis;
    white-space: nowrap;

    @container pricing-table (width >= 760px) {
      overflow: hidden;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;

      text-overflow: initial;
      white-space: normal;
    }
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
    height: 54px;
    border: 0 !important;
    border-radius: 10px;

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

const formatCreditsPerMillionTokens = (credits: number) => {
  const millions = credits / 1_000_000;

  return `${Number(millions.toFixed(3))}M`;
};

const formatContextWindow = (tokens: number) => {
  if (tokens >= 1_000_000) return `${tokens / 1_000_000}M`;

  return `${Math.round(tokens / 1000)}K`;
};

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
  const { data: textModelPricing = [] } = useTextModelPricing();
  const [channel, setChannel] = useState<PaymentChannel>('alipay');
  const [createdOrder, setCreatedOrder] = useState<CreatedSubscriptionOrder>();
  const [createOrderError, setCreateOrderError] = useState<string>();
  const [isCreatingOrder, setIsCreatingOrder] = useState<string>();
  const [mode, setMode] = useState<BillingMode>('year');
  const [openOneTimePlanId, setOpenOneTimePlanId] = useState<SubscriptionPlanId>();
  const [oneTimeDurations, setOneTimeDurations] = useState<
    Partial<Record<SubscriptionPlanId, OneTimeDuration>>
  >({});

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

    const priceMeta = DISPLAY_PRICE_META[planId];

    return [
      {
        accent: getPlanAccent(planId),
        action: getPlanAction(planId, Boolean(plan.purchasable)),
        amountCents: plan.amountCents?.[mode === 'month' ? 'month' : 'year'] ?? 0,
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
        monthlyEquivalent: priceMeta.yearlyMonthly,
        monthlyPrice: priceMeta.monthlyPrice,
        name: t(`plans.plan.${planId}.title`, plan.name),
        oneTimeOptions: [...priceMeta.oneTimeOptions],
        originalYearly: priceMeta.originalYearly,
        yearlyDiscount: priceMeta.yearlyDiscount,
      },
    ];
  });

  const getSelectedOneTimeOption = (plan: HeroPlan) =>
    plan.oneTimeOptions.find((option) => option.value === (oneTimeDurations[plan.id] ?? 'year')) ??
    plan.oneTimeOptions.at(-1)!;

  const getOrderPeriod = (plan: HeroPlan): SubscriptionPeriod => {
    if (mode === 'month') return 'month';
    if (mode === 'oneTime') return getSelectedOneTimeOption(plan).period;

    return 'year';
  };

  const handleCreateOrder = async (plan: HeroPlan) => {
    const { action, id: planId } = plan;
    if (action === 'availableAfterExpiry' || action === 'unavailable') return;

    setIsCreatingOrder(`${action}:${planId}`);
    setCreateOrderError(undefined);

    try {
      const period = getOrderPeriod(plan);
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

  const getPrimaryActionLabel = (action: PlanAction) => {
    if (mode === 'oneTime' && action === 'purchase')
      return t('billingNative.plans.pixel.buyNow', 'Buy now');

    return getActionLabel(action);
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
              data-active={mode === 'year'}
              type={'text'}
              onClick={() => setMode('year')}
            >
              {t('billingNative.plans.pixel.period.yearly', 'Yearly')}
              <Text
                as={'span'}
                className={styles.discountBadge}
                style={{
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
              data-active={mode === 'month'}
              type={'text'}
              onClick={() => setMode('month')}
            >
              {t('billingNative.plans.pixel.period.monthly', 'Monthly')}
            </Button>
            <Flexbox
              horizontal
              className={styles.toggleButton}
              data-active={mode === 'oneTime'}
              role="button"
              tabIndex={0}
              onClick={() => setMode('oneTime')}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') setMode('oneTime');
              }}
            >
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
            </Flexbox>
          </div>
        </Flexbox>
      </Flexbox>

      <div className={styles.heroCards}>
        {planCards.map((plan) => {
          const selectedOneTimeOption = getSelectedOneTimeOption(plan);
          const isOneTimeMenuOpen = openOneTimePlanId === plan.id;

          return (
            <Flexbox className={styles.heroCard} gap={0} key={plan.id}>
              <Flexbox className={styles.planIntro} gap={0}>
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
              </Flexbox>

              <Flexbox className={styles.planPurchase}>
                {mode === 'oneTime' ? (
                  <Flexbox gap={14}>
                    <div className={styles.oneTimeSelect}>
                      <button
                        aria-expanded={isOneTimeMenuOpen}
                        className={styles.oneTimeSelectButton}
                        type="button"
                        onBlur={(event) => {
                          if (!event.currentTarget.parentElement?.contains(event.relatedTarget)) {
                            setOpenOneTimePlanId(undefined);
                          }
                        }}
                        onClick={() =>
                          setOpenOneTimePlanId(isOneTimeMenuOpen ? undefined : plan.id)
                        }
                      >
                        <span className={styles.priceLine}>
                          <Text as={'span'} fontSize={17} weight={800}>
                            {selectedOneTimeOption.price}
                          </Text>
                          <Text as={'span'} fontSize={14} weight={600}>
                            / {t(selectedOneTimeOption.labelKey)}
                          </Text>
                          {selectedOneTimeOption.discount ? (
                            <Text
                              as={'span'}
                              className={styles.discountBadge}
                              fontSize={12}
                              style={{ paddingBlock: 2, paddingInline: 6 }}
                            >
                              {t('billingNative.plans.pixel.discount.short', {
                                percent: selectedOneTimeOption.discount,
                              })}
                            </Text>
                          ) : null}
                        </span>
                        <Icon color={cssVar.colorTextTertiary} icon={ChevronDownIcon} size={14} />
                      </button>
                      {isOneTimeMenuOpen ? (
                        <div className={styles.oneTimeSelectMenu}>
                          {plan.oneTimeOptions.map((option) => (
                            <button
                              className={styles.oneTimeSelectOption}
                              data-active={option.value === selectedOneTimeOption.value}
                              key={option.value}
                              type="button"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => {
                                setOneTimeDurations((prev) => ({
                                  ...prev,
                                  [plan.id]: option.value,
                                }));
                                setOpenOneTimePlanId(undefined);
                              }}
                            >
                              <span className={styles.priceLine}>
                                <Text as={'span'} fontSize={17} weight={800}>
                                  {option.price}
                                </Text>
                                <Text as={'span'} fontSize={14} weight={600}>
                                  / {t(option.labelKey)}
                                </Text>
                                {option.discount ? (
                                  <Text
                                    as={'span'}
                                    className={styles.discountBadge}
                                    fontSize={12}
                                    style={{ paddingBlock: 2, paddingInline: 6 }}
                                  >
                                    {t('billingNative.plans.pixel.discount.short', {
                                      percent: option.discount,
                                    })}
                                  </Text>
                                ) : null}
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <Flexbox horizontal align={'center'} className={styles.oneTimePayment} gap={4}>
                      {t(
                        'billingNative.plans.pixel.payment.supports',
                        'Supports credit card / Alipay / WeChat Pay',
                      )}
                      <span className={styles.channelIcon} style={{ background: '#14a8f5' }}>
                        {t('billingNative.plans.pixel.payment.alipayMark', 'Ali')}
                      </span>
                      <span className={styles.channelIcon} style={{ background: '#08bf22' }}>
                        ✓
                      </span>
                    </Flexbox>
                  </Flexbox>
                ) : (
                  <Flexbox>
                    <Text className={styles.price}>
                      {mode === 'year' ? plan.monthlyEquivalent : plan.monthlyPrice}
                      <Text as={'span'} fontSize={14} weight={600}>
                        {' '}
                        {t(
                          mode === 'year'
                            ? 'billingNative.plans.pixel.price.perMonthYearly'
                            : 'billingNative.plans.pixel.price.perMonth',
                        )}
                      </Text>
                    </Text>
                    {mode === 'year' ? (
                      <Flexbox horizontal align={'center'} gap={8}>
                        <Text className={styles.priceCaption}>
                          {t('billingNative.plans.pixel.price.perYear', {
                            price: plan.originalYearly,
                          })}
                        </Text>
                        <Text
                          as={'span'}
                          className={styles.discountBadge}
                          style={{
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
                )}
                <div className={styles.buttonSlot}>
                  <Button
                    className={styles.planButton}
                    loading={isCreatingOrder === `${plan.action}:${plan.id}`}
                    type={'primary'}
                    disabled={
                      plan.action === 'availableAfterExpiry' || plan.action === 'unavailable'
                    }
                    onClick={() => void handleCreateOrder(plan)}
                  >
                    {getPrimaryActionLabel(plan.action)}
                  </Button>
                </div>
              </Flexbox>

              <Flexbox className={styles.benefits} gap={15}>
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
                <div className={styles.allowanceItem}>
                  <Icon color="#2ba84a" icon={CheckIcon} size={14} />
                  <Text color={cssVar.colorTextSecondary} fontSize={15}>
                    {t('plans.message.more', 'More models in plan comparison')}
                  </Text>
                </div>
                {PLAN_FEATURE_GROUPS.map((group) => (
                  <Flexbox className={styles.benefitGroup} key={group.titleKey}>
                    <Flexbox horizontal align={'center'} gap={5}>
                      <Text className={styles.benefitGroupTitle}>{t(group.titleKey)}</Text>
                      {group.tooltip ? (
                        <Icon color={cssVar.colorTextTertiary} icon={CircleHelpIcon} size={14} />
                      ) : null}
                    </Flexbox>
                    {group.itemKeys.map((itemKey) => (
                      <div className={styles.benefitItem} key={itemKey}>
                        <Icon color="#2ba84a" icon={CheckIcon} size={14} />
                        <Text>{t(itemKey)}</Text>
                      </div>
                    ))}
                  </Flexbox>
                ))}
                <Flexbox className={styles.benefitGroup}>
                  <Text className={styles.benefitGroupTitle}>{t('plans.support.title')}</Text>
                  <Text className={styles.supportText}>{t(PLAN_SUPPORT_KEYS[plan.id])}</Text>
                </Flexbox>
              </Flexbox>
            </Flexbox>
          );
        })}
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

      <div className={styles.priceLayout}>
        <Flexbox flex={1} gap={12} style={{ minWidth: 280 }}>
          <Text className={styles.priceSectionTitle}>{t('modelPricing.title')}</Text>
          <Text color={cssVar.colorTextSecondary} fontSize={18} style={{ lineHeight: 1.6 }}>
            {t('modelPricing.desc', { name: CLOUD_NAME })}
          </Text>
          <Button className={styles.priceDocsButton}>{t('modelPricing.button')}</Button>
        </Flexbox>
        <div className={styles.priceTablePanel}>
          <table className={styles.priceTable}>
            <colgroup>
              <col style={{ width: '52%' }} />
              <col style={{ width: '24%' }} />
              <col style={{ width: '24%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>{t('models.title')}</th>
                <th>
                  {t('models.input')}
                  <span className={styles.priceTokenBadge}>
                    {t('modelPricing.perMillionTokens')}
                  </span>
                </th>
                <th>
                  {t('models.output')}
                  <span className={styles.priceTokenBadge}>
                    {t('modelPricing.perMillionTokens')}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {textModelPricing.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Flexbox horizontal align={'center'} gap={16}>
                      <ModelIcon model={item.model} size={28} type={'avatar'} />
                      <Text className={styles.pricingModelName}>
                        {item.displayName} ({formatContextWindow(item.contextWindowTokens)})
                      </Text>
                    </Flexbox>
                  </td>
                  <td>
                    <span className={styles.priceTableRate}>
                      {formatCreditsPerMillionTokens(item.inputCreditsPerMillionTokens)}
                      <span className={styles.priceTableUnit}>
                        {t('billingNative.billing.creditsUnit')}
                      </span>
                    </span>
                  </td>
                  <td>
                    <span className={styles.priceTableRate}>
                      {formatCreditsPerMillionTokens(item.outputCreditsPerMillionTokens)}
                      <span className={styles.priceTableUnit}>
                        {t('billingNative.billing.creditsUnit')}
                      </span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
                  onClick={() => void handleCreateOrder(plan)}
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
