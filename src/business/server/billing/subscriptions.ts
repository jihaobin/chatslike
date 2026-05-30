import { and, desc, eq, inArray } from 'drizzle-orm';

import { billingOrders } from '@/database/schemas';
import type { BillingOrderItem, PaymentChannel } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';

import {
  BILLING_CURRENCY,
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_PRICE_CENTS,
  TEMPORARY_TEST_PRICE_SOURCE,
} from './constants';
import { BillingError } from './errors';
import type { CreatePaymentResult } from './payments/types';

export type SubscriptionPlanId = keyof typeof SUBSCRIPTION_PLANS;
export type SubscriptionPeriod = 'month' | 'year';

const PLAN_ORDER = ['starter', 'premium', 'ultimate'] as const;
const PLAN_RANK = Object.fromEntries(PLAN_ORDER.map((planId, index) => [planId, index])) as Record<
  SubscriptionPlanId,
  number
>;
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export const listSubscriptionPlans = () =>
  PLAN_ORDER.map((planId) => ({
    ...SUBSCRIPTION_PLANS[planId],
    amountCents: SUBSCRIPTION_PRICE_CENTS[planId],
    currency: BILLING_CURRENCY,
    priceSource: TEMPORARY_TEST_PRICE_SOURCE,
    purchasable: true,
  }));

const isSubscriptionPlanId = (value: string | null): value is SubscriptionPlanId =>
  Boolean(value && value in SUBSCRIPTION_PLANS);

const getPeriodMs = (period: SubscriptionPeriod) => (period === 'year' ? YEAR_MS : MONTH_MS);

export const getSubscriptionCycleCount = (period: SubscriptionPeriod) => (period === 'year' ? 12 : 1);

const readDateMetadata = (
  metadata: Record<string, unknown> | null | undefined,
  key: 'validFrom' | 'validUntil',
) => {
  const value = metadata?.[key];
  if (typeof value !== 'string') return undefined;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? undefined : date;
};

export interface CurrentSubscription {
  currentPeriodEnd: Date;
  currentPeriodStart: Date;
  orderId: string;
  period: SubscriptionPeriod;
  planId: SubscriptionPlanId;
}

export interface CreateSubscriptionOrderParams {
  channel: PaymentChannel;
  period: SubscriptionPeriod;
  planId: SubscriptionPlanId;
}

export interface CreateRenewOrderParams {
  channel: PaymentChannel;
  period: SubscriptionPeriod;
  planId: SubscriptionPlanId;
}

export interface CreateUpgradeOrderParams {
  channel: PaymentChannel;
  targetPlanId: SubscriptionPlanId;
}

export interface CreateSubscriptionPaymentResult {
  order: BillingOrderItem;
  payment: CreatePaymentResult;
}

export function calculateUpgradeCreditDelta(params: {
  currentPlanId: SubscriptionPlanId;
  targetPlanId: SubscriptionPlanId;
}) {
  return (
    SUBSCRIPTION_PLANS[params.targetPlanId].creditsPerMonth -
    SUBSCRIPTION_PLANS[params.currentPlanId].creditsPerMonth
  );
}

export function calculateUpgradePriceDelta(params: {
  currentPlanId: SubscriptionPlanId;
  period: SubscriptionPeriod;
  targetPlanId: SubscriptionPlanId;
}) {
  return (
    SUBSCRIPTION_PRICE_CENTS[params.targetPlanId][params.period] -
    SUBSCRIPTION_PRICE_CENTS[params.currentPlanId][params.period]
  );
}

export function getSubscriptionPriceCents(planId: SubscriptionPlanId, period: SubscriptionPeriod) {
  return SUBSCRIPTION_PRICE_CENTS[planId][period];
}

export function getSubscriptionCredits(planId: SubscriptionPlanId, _period: SubscriptionPeriod) {
  return SUBSCRIPTION_PLANS[planId].creditsPerMonth;
}

export function getSubscriptionValidUntil(params: {
  currentPeriodEnd?: Date;
  now?: Date;
  period: SubscriptionPeriod;
}) {
  const now = params.now ?? new Date();
  const baseTime = params.currentPeriodEnd && params.currentPeriodEnd > now ? params.currentPeriodEnd : now;

  return new Date(baseTime.getTime() + getPeriodMs(params.period));
}

export async function getCurrentSubscription(
  db: LobeChatDatabase,
  userId: string,
  now = new Date(),
): Promise<CurrentSubscription | null> {
  const orders = await db
    .select()
    .from(billingOrders)
    .where(
      and(
        eq(billingOrders.userId, userId),
        eq(billingOrders.status, 'activated'),
        inArray(billingOrders.orderType, [
          'subscription_new',
          'subscription_renew',
          'subscription_upgrade',
        ]),
      ),
    )
    .orderBy(desc(billingOrders.activatedAt), desc(billingOrders.createdAt));

  for (const order of orders) {
    if (order.userId !== userId || order.status !== 'activated') continue;
    if (!isSubscriptionPlanId(order.planId)) continue;

    const metadata = (order.metadata as Record<string, unknown> | null) ?? {};
    const currentPeriodEnd = readDateMetadata(metadata, 'validUntil');
    const currentPeriodStart = readDateMetadata(metadata, 'validFrom') ?? order.activatedAt ?? order.createdAt;
    const period = order.period === 'year' ? 'year' : 'month';

    if (!currentPeriodEnd || currentPeriodEnd <= now) continue;

    return {
      currentPeriodEnd,
      currentPeriodStart,
      orderId: order.id,
      period,
      planId: order.planId,
    };
  }

  return null;
}

export function assertCanRenewSubscription(params: {
  current: CurrentSubscription | null;
  planId: SubscriptionPlanId;
}) {
  if (!params.current || params.current.planId !== params.planId) {
    throw new BillingError('SUBSCRIPTION_RENEW_NOT_ALLOWED', 'Only current plan can be renewed', {
      currentPlanId: params.current?.planId,
      planId: params.planId,
    });
  }
}

export function assertCanUpgradeSubscription(params: {
  current: CurrentSubscription | null;
  targetPlanId: SubscriptionPlanId;
}) {
  if (!params.current) {
    throw new BillingError('SUBSCRIPTION_UPGRADE_NOT_ALLOWED', 'No active subscription to upgrade', {
      targetPlanId: params.targetPlanId,
    });
  }

  if (PLAN_RANK[params.targetPlanId] <= PLAN_RANK[params.current.planId]) {
    throw new BillingError('SUBSCRIPTION_UPGRADE_NOT_ALLOWED', 'Only higher plans can be upgraded', {
      currentPlanId: params.current.planId,
      targetPlanId: params.targetPlanId,
    });
  }
}
