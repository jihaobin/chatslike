'use client';

import { ModelIcon } from '@lobehub/icons';
import { Button, Flexbox, Icon, Skeleton, Text, Tooltip } from '@lobehub/ui';
import { message } from 'antd';
import { createStaticStyles, cssVar } from 'antd-style';
import type { LucideIcon } from 'lucide-react';
import {
  AtomIcon,
  CheckIcon,
  ChevronDownIcon,
  CircleHelpIcon,
  SparklesIcon,
  ZapIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { memo, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { billingService } from '@/services/billing';
import { formatNumber } from '@/utils/format';

import { type PaymentChannel, PaymentChannelModal } from './components/PaymentChannelModal';
import { PaymentQrCodeModal, type PaymentQrCodeStatus } from './components/PaymentQrCodeModal';
import {
  refreshBillingOrders,
  useBillingOrderPaymentStatus,
  useCurrentSubscription,
  useSubscriptionPlans,
  useTextModelPricing,
} from './hooks/useBillingData';
import { formatBillingAmount } from './utils';

const CLOUD_NAME = 'LobeHub Cloud';
const MESSAGE_ESTIMATE_TOKENS = 2500;

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
  yearlyDiscount?: string;
  yearlyOriginalPrice: string;
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
  model?: string;
  name: string;
  premium: string;
  pricingDisplayName?: string;
  provider?: string;
  starter: string;
  ultimate: string;
}

interface TextModelPricing {
  displayName: string;
  inputCreditsPerMillionTokens: number;
  model: string;
  outputCreditsPerMillionTokens: number;
  provider: string;
}

type TranslationValues = { defaultValue?: string } & Record<string, number | string | undefined>;

interface TranslateString {
  (key: string): string;
  (key: string, values: TranslationValues): string;
}

const translateString = (
  t: TranslateString,
  key: string,
  fallback: string,
  values?: TranslationValues,
) => t(key, { ...values, defaultValue: fallback });

const PaymentChannelMarks = memo(() => (
  <>
    <img alt="Alipay" className={styles.channelIcon} src="/icons/Alipay.svg" />
    <img alt="WeChat Pay" className={styles.channelIcon} src="/icons/Wechat.svg" />
  </>
));

const PLAN_RANK = {
  premium: 1,
  starter: 0,
  ultimate: 2,
} as const satisfies Record<SubscriptionPlanId, number>;

const DISPLAY_PRICE_META = {
  premium: {
    oneTimeOptions: [
      { labelKey: 'recurring.oneMonth', period: 'month', value: 'month' },
      { labelKey: 'recurring.threeMonth', period: 'month', value: 'quarter' },
      { labelKey: 'recurring.sixMonth', period: 'month', value: 'halfYear' },
      {
        labelKey: 'recurring.oneYear',
        period: 'year',
        value: 'year',
      },
    ],
  },
  starter: {
    oneTimeOptions: [
      { labelKey: 'recurring.oneMonth', period: 'month', value: 'month' },
      { labelKey: 'recurring.threeMonth', period: 'month', value: 'quarter' },
      { labelKey: 'recurring.sixMonth', period: 'month', value: 'halfYear' },
      {
        labelKey: 'recurring.oneYear',
        period: 'year',
        value: 'year',
      },
    ],
  },
  ultimate: {
    oneTimeOptions: [
      { labelKey: 'recurring.oneMonth', period: 'month', value: 'month' },
      { labelKey: 'recurring.threeMonth', period: 'month', value: 'quarter' },
      { labelKey: 'recurring.sixMonth', period: 'month', value: 'halfYear' },
      {
        labelKey: 'recurring.oneYear',
        period: 'year',
        value: 'year',
      },
    ],
  },
} as const satisfies Record<
  SubscriptionPlanId,
  {
    oneTimeOptions: Array<Omit<OneTimeOption, 'discount' | 'price'>>;
  }
>;

const MODEL_ALLOWANCES: ModelAllowance[] = [
  {
    iconClassName: 'deepseek',
    kind: 'message',
    model: 'deepseek-v4-pro',
    name: 'DeepSeek V4 Pro',
    pricingDisplayName: 'DeepSeek V4 Pro',
    provider: 'deepseek',
    premium: '10,600',
    starter: '3,500',
    ultimate: '24,800',
  },
  {
    iconClassName: 'claude',
    kind: 'message',
    model: 'claude-opus-4.8',
    name: 'Claude Opus 4.8',
    pricingDisplayName: 'Claude Opus 4.8',
    premium: '500',
    starter: '200',
    ultimate: '1,300',
  },
  {
    iconClassName: 'gpt',
    kind: 'message',
    model: 'gpt-5.5',
    name: 'GPT-5.5',
    pricingDisplayName: 'GPT-5.5',
    premium: '500',
    starter: '200',
    ultimate: '1,100',
  },
  {
    iconClassName: 'gemini',
    kind: 'message',
    model: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro Preview',
    pricingDisplayName: 'Gemini 3.1 Pro Preview',
    premium: '1,200',
    starter: '400',
    ultimate: '2,800',
  },
  {
    iconClassName: 'gemini',
    kind: 'message',
    model: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash-Lite',
    pricingDisplayName: 'Gemini 3.1 Flash-Lite',
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
    width: 16px;
    height: 16px;
    border-radius: 4px;
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
    justify-content: center;
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
  priceLayout: css`
    display: block;
  `,
  priceTable: css`
    table-layout: fixed;
    border-collapse: collapse;
    width: 100%;

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
      line-height: 1;
      color: ${token.colorText};
      white-space: nowrap;
      vertical-align: middle;

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
    display: inline-flex;
    align-items: center;

    margin-inline-start: 8px;
    padding-block: 3px;
    padding-inline: 8px;
    border-radius: 5px;

    font-size: 14px;
    font-weight: 700;
    line-height: 1;
    color: ${token.colorTextSecondary};
    vertical-align: middle;

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
    cursor: pointer;

    display: flex !important;
    align-items: center;
    justify-content: center;

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

const formatPlanAmount = (amountCents: number, currency = 'CNY') =>
  formatBillingAmount(amountCents, currency, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  });

const calculateDiscountPercent = (originalAmountCents: number, discountedAmountCents: number) => {
  if (originalAmountCents <= 0 || discountedAmountCents >= originalAmountCents) return undefined;

  return `${Math.round(((originalAmountCents - discountedAmountCents) / originalAmountCents) * 100)}%`;
};

const getPlanOptionAmountCents = (params: {
  monthlyAmountCents: number;
  option: Pick<OneTimeOption, 'period' | 'value'>;
  yearlyAmountCents: number;
}) => {
  if (params.option.value === 'quarter') return params.monthlyAmountCents * 3;
  if (params.option.value === 'halfYear') return params.monthlyAmountCents * 6;
  if (params.option.period === 'year') return params.yearlyAmountCents;

  return params.monthlyAmountCents;
};

const formatCreditsPerMillionTokens = (credits: number) => {
  const millions = credits / 1_000_000;

  return `${Number(millions.toFixed(3))}M`;
};

const formatContextWindow = (tokens: number) => {
  if (tokens >= 1_000_000) return `${tokens / 1_000_000}M`;

  return `${Math.round(tokens / 1000)}K`;
};

const calculateEstimatedMessages = (credits: number, pricing?: TextModelPricing) => {
  if (!pricing) return undefined;

  const creditsPerMessage =
    (pricing.inputCreditsPerMillionTokens * MESSAGE_ESTIMATE_TOKENS) / 1_000_000;

  if (creditsPerMessage <= 0) return undefined;

  return Math.floor(credits / creditsPerMessage);
};

const findAllowancePricing = (item: ModelAllowance, pricingRows: TextModelPricing[]) => {
  if (item.kind !== 'message') return undefined;

  return pricingRows.find((pricing) => {
    if (item.provider && pricing.provider !== item.provider) return false;

    return (
      pricing.displayName === item.name ||
      pricing.displayName === item.pricingDisplayName ||
      pricing.model === item.model
    );
  });
};

const getPlanCredits = (planId: SubscriptionPlanId, planCards: HeroPlan[]) =>
  planCards.find((plan) => plan.id === planId)?.credits;

const getFallbackAllowanceAmount = (item: ModelAllowance, planId: SubscriptionPlanId) =>
  planId === 'starter' ? item.starter : planId === 'premium' ? item.premium : item.ultimate;

const getEstimatedAllowanceAmount = (params: {
  item: ModelAllowance;
  planCards: HeroPlan[];
  planId: SubscriptionPlanId;
  pricing?: TextModelPricing;
}) => {
  const fallback = getFallbackAllowanceAmount(params.item, params.planId);
  if (params.item.kind !== 'message') return fallback;

  const credits = getPlanCredits(params.planId, params.planCards);
  const messages =
    credits === undefined ? undefined : calculateEstimatedMessages(credits, params.pricing);

  return messages === undefined ? fallback : formatNumber(messages);
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
  const [createdOrder, setCreatedOrder] = useState<CreatedSubscriptionOrder>();
  const [createOrderError, setCreateOrderError] = useState<string>();
  const [isCreatingOrder, setIsCreatingOrder] = useState<string>();
  const [isPaymentQrCodeModalOpen, setIsPaymentQrCodeModalOpen] = useState(false);
  const [pendingPaymentPlan, setPendingPaymentPlan] = useState<HeroPlan>();
  const [mode, setMode] = useState<BillingMode>('year');
  const [openOneTimePlanId, setOpenOneTimePlanId] = useState<SubscriptionPlanId>();
  const [oneTimeDurations, setOneTimeDurations] = useState<
    Partial<Record<SubscriptionPlanId, OneTimeDuration>>
  >({});
  const { data: paymentStatus } = useBillingOrderPaymentStatus(createdOrder?.order.id);
  const polledOrder = paymentStatus?.order;
  const paymentTradeState = paymentStatus?.paymentTradeState;
  const lastNotifiedOrderStateRef = useRef<string | undefined>(undefined);

  const paymentQrCodeStatus: PaymentQrCodeStatus =
    paymentTradeState === 'USERPAYING'
      ? 'paying'
      : polledOrder?.status === 'paid' || paymentTradeState === 'SUCCESS'
        ? 'loading'
        : polledOrder?.status === 'closed' ||
            paymentTradeState === 'CLOSED' ||
            paymentTradeState === 'REVOKED'
          ? 'expired'
          : 'waiting';

  useEffect(() => {
    if (!createdOrder || !polledOrder?.status) return;

    const notifiedKey = `${createdOrder.order.id}:${polledOrder.status}:${paymentTradeState ?? ''}`;
    if (lastNotifiedOrderStateRef.current === notifiedKey) return;
    lastNotifiedOrderStateRef.current = notifiedKey;

    if (paymentTradeState === 'USERPAYING') {
      message.info(
        t('billingNative.paymentStatus.paying', 'Scanned. Confirm the payment on your phone.'),
      );
      return;
    }

    if (polledOrder.status === 'paid') {
      message.info(
        t('billingNative.paymentStatus.paying', 'Scanned. Confirm the payment on your phone.'),
      );
      return;
    }

    if (polledOrder.status === 'activated') {
      setIsPaymentQrCodeModalOpen(false);
      message.success(
        t('billingNative.paymentStatus.success', 'Payment successful. Credits have been added.'),
      );
      void refreshBillingOrders();
      return;
    }

    if (polledOrder.status === 'failed' || polledOrder.status === 'exception') {
      setIsPaymentQrCodeModalOpen(false);
      message.error(t('billingNative.paymentStatus.failed', 'Payment failed. Please try again.'));
      void refreshBillingOrders();
      return;
    }

    if (polledOrder.status === 'closed') {
      setIsPaymentQrCodeModalOpen(false);
      message.info(t('billingNative.paymentStatus.cancelled', 'Payment cancelled'));
      void refreshBillingOrders();
    }
  }, [createdOrder, paymentTradeState, polledOrder?.status, t]);

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
    const monthlyAmountCents = plan.amountCents?.month ?? 0;
    const yearlyAmountCents = plan.amountCents?.year ?? 0;
    const yearlyMonthlyAmountCents = Math.round(yearlyAmountCents / 12);
    const yearlyOriginalAmountCents = monthlyAmountCents * 12;
    const yearlyDiscount = calculateDiscountPercent(yearlyOriginalAmountCents, yearlyAmountCents);
    const currency = plan.currency ?? 'CNY';

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
        monthlyEquivalent: formatPlanAmount(yearlyMonthlyAmountCents, currency),
        monthlyPrice: formatPlanAmount(monthlyAmountCents, currency),
        name: t(`plans.plan.${planId}.title`, plan.name),
        oneTimeOptions: priceMeta.oneTimeOptions.map((option) => {
          const optionAmountCents = getPlanOptionAmountCents({
            monthlyAmountCents,
            option,
            yearlyAmountCents,
          });

          return {
            ...option,
            discount:
              option.period === 'year'
                ? calculateDiscountPercent(yearlyOriginalAmountCents, optionAmountCents)
                : undefined,
            price: formatPlanAmount(optionAmountCents, currency),
          };
        }),
        yearlyDiscount,
        yearlyOriginalPrice: formatPlanAmount(yearlyOriginalAmountCents, currency),
      },
    ];
  });

  const maxYearlyDiscount = planCards
    .map((plan) => plan.yearlyDiscount)
    .filter((discount): discount is string => Boolean(discount))
    .sort((a, b) => Number.parseInt(b) - Number.parseInt(a))[0];

  const getSelectedOneTimeOption = (plan: HeroPlan) =>
    plan.oneTimeOptions.find((option) => option.value === (oneTimeDurations[plan.id] ?? 'year')) ??
    plan.oneTimeOptions.at(-1)!;

  const getOrderPeriod = (plan: HeroPlan): SubscriptionPeriod => {
    if (mode === 'month') return 'month';
    if (mode === 'oneTime') return getSelectedOneTimeOption(plan).period;

    return 'year';
  };

  const handleCreateOrder = async (plan: HeroPlan, channel: PaymentChannel) => {
    const { action, id: planId } = plan;
    if (action === 'availableAfterExpiry' || action === 'unavailable') return;

    setPendingPaymentPlan(undefined);
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
      setIsPaymentQrCodeModalOpen(Boolean(result.payment.qrCodeUrl));
      lastNotifiedOrderStateRef.current = undefined;
      await refreshBillingOrders();
    } catch (error) {
      setCreateOrderError(error instanceof Error ? error.message : String(error));
      message.error(
        t(
          'billingNative.paymentStatus.createFailed',
          'Failed to create the order. Please try again later.',
        ),
      );
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
    const amount = getEstimatedAllowanceAmount({
      item,
      planCards,
      planId,
      pricing: findAllowancePricing(item, textModelPricing),
    });
    const key =
      item.kind === 'image'
        ? 'billingNative.plans.pixel.approxImages'
        : 'billingNative.plans.pixel.approxMessages';

    return t(key, { amount });
  };
  const messageEstimateTooltip = t('plans.message.tooltip', {
    number: MESSAGE_ESTIMATE_TOKENS,
  });

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
              {maxYearlyDiscount ? (
                <Text
                  as={'span'}
                  className={styles.discountBadge}
                  style={{
                    marginInlineStart: 8,
                    paddingBlock: 2,
                    paddingInline: 6,
                  }}
                >
                  {t('billingNative.plans.pixel.discount.max', { percent: maxYearlyDiscount })}
                </Text>
              ) : null}
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
                <PaymentChannelMarks />
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
                            /{' '}
                            {translateString(
                              t,
                              selectedOneTimeOption.labelKey,
                              selectedOneTimeOption.labelKey,
                            )}
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
                                  / {translateString(t, option.labelKey, option.labelKey)}
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
                      <PaymentChannelMarks />
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
                            price: plan.yearlyOriginalPrice,
                          })}
                        </Text>
                        {plan.yearlyDiscount ? (
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
                        ) : null}
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
                    onClick={() => setPendingPaymentPlan(plan)}
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
                        <Tooltip title={messageEstimateTooltip}>
                          <Icon color={cssVar.colorTextTertiary} icon={CircleHelpIcon} size={13} />
                        </Tooltip>
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
                      {'tooltip' in group && group.tooltip ? (
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

      <div className={styles.priceLayout}>
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
                  onClick={() => setPendingPaymentPlan(plan)}
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
            <MemoCompareAllowance
              item={item}
              key={item.name}
              planCards={planCards}
              pricing={findAllowancePricing(item, textModelPricing)}
              t={t}
            />
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

      <PaymentChannelModal
        open={Boolean(pendingPaymentPlan)}
        onOpenChange={(open) => {
          if (!open) setPendingPaymentPlan(undefined);
        }}
        onSelect={(selectedChannel) => {
          if (pendingPaymentPlan) void handleCreateOrder(pendingPaymentPlan, selectedChannel);
        }}
      />
      {createdOrder ? (
        <PaymentQrCodeModal
          amountCents={createdOrder.order.amountCents}
          currency={createdOrder.order.currency}
          open={isPaymentQrCodeModalOpen}
          orderId={createdOrder.order.id}
          qrCodeUrl={createdOrder.payment.qrCodeUrl ?? createdOrder.payment.paymentUrl}
          status={paymentQrCodeStatus}
          onOpenChange={setIsPaymentQrCodeModalOpen}
        />
      ) : null}
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
  planCards: HeroPlan[];
  pricing?: TextModelPricing;
  t: TranslateString;
}>(({ item, planCards, pricing, t }) => {
  const key =
    item.kind === 'image'
      ? 'billingNative.plans.pixel.approxImages'
      : 'billingNative.plans.pixel.approxMessages';
  const starter = getEstimatedAllowanceAmount({ item, planCards, planId: 'starter', pricing });
  const premium = getEstimatedAllowanceAmount({ item, planCards, planId: 'premium', pricing });
  const ultimate = getEstimatedAllowanceAmount({ item, planCards, planId: 'ultimate', pricing });

  return (
    <>
      <Flexbox className={styles.compareTitleCell}>
        <Flexbox horizontal align={'center'} gap={8}>
          <span className={styles.modelIcon} data-kind={item.iconClassName} />
          {item.name}
        </Flexbox>
      </Flexbox>
      <Flexbox align={'center'} className={styles.compareCell} justify={'center'}>
        {translateString(t, key, starter, { amount: starter })}
      </Flexbox>
      <Flexbox align={'center'} className={styles.compareCell} justify={'center'}>
        {translateString(t, key, premium, { amount: premium })}
      </Flexbox>
      <Flexbox align={'center'} className={styles.compareCell} justify={'center'}>
        {translateString(t, key, ultimate, { amount: ultimate })}
      </Flexbox>
    </>
  );
});

MemoCompareAllowance.displayName = 'MemoCompareAllowance';

Plans.displayName = 'Plans';
export default Plans;
