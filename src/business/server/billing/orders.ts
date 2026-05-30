import { eq } from 'drizzle-orm';

import {
  BillingOrderModel,
  PaymentTransactionModel,
  type ListBillingOrdersParams,
} from '@/database/models/billing';
import { billingOrders } from '@/database/schemas';
import type { BillingOrderItem, PaymentChannel } from '@/database/schemas';
import type { LobeChatDatabase, Transaction } from '@/database/type';

import {
  BILLING_CURRENCY,
  SUBSCRIPTION_PLANS,
  TEMPORARY_TEST_PRICE_SOURCE,
  TOP_UP_PRODUCTS,
} from './constants';
import { CreditsService } from './credits';
import { BillingError } from './errors';
import { getPaymentAdapter } from './payments';
import type { CreatePaymentResult } from './payments/types';
import {
  assertCanRenewSubscription,
  assertCanUpgradeSubscription,
  calculateUpgradePriceDelta,
  getCurrentSubscription,
  getSubscriptionCycleCount,
  getSubscriptionCredits,
  getSubscriptionPriceCents,
  getSubscriptionValidUntil,
  type CreateRenewOrderParams,
  type CreateSubscriptionOrderParams,
  type CreateSubscriptionPaymentResult,
  type CreateUpgradeOrderParams,
} from './subscriptions';

interface CreateTopUpOrderParams {
  channel: PaymentChannel;
  productId: string;
}

export interface CreateTopUpOrderResult {
  order: BillingOrderItem;
  payment: CreatePaymentResult;
}

interface MarkPaidAndActivateParams {
  amountCents: number;
  channel: PaymentChannel;
  orderId: string;
  providerTransactionId: string;
  rawCallback: Record<string, unknown>;
  signatureVerified: boolean;
  succeeded: boolean;
}

type BillingDb = LobeChatDatabase | Transaction;

const isTransactionalDb = (db: BillingDb): db is LobeChatDatabase =>
  'transaction' in db && typeof db.transaction === 'function';

const readSubscriptionOrderDate = (
  order: BillingOrderItem,
  key: 'currentPeriodEnd' | 'validFrom' | 'validUntil',
): Date | undefined => {
  const metadata = (order.metadata as Record<string, unknown> | null) ?? {};
  const value = metadata[key];

  if (typeof value !== 'string') {
    return undefined;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new BillingError('SUBSCRIPTION_ORDER_METADATA_INVALID', 'Subscription order metadata invalid', {
      key,
      orderId: order.id,
      value,
    });
  }

  return date;
};

const getOrderMetadata = (order: BillingOrderItem) =>
  (order.metadata as Record<string, unknown> | null) ?? {};

const getSubscriptionActivationPeriod = (
  order: BillingOrderItem,
  activatedAt: Date,
): { startsAt: Date; validUntil: Date } => {
  if (order.orderType === 'subscription_renew') {
    const startsAt = readSubscriptionOrderDate(order, 'validFrom');
    const validUntil = readSubscriptionOrderDate(order, 'validUntil');

    if (!startsAt || !validUntil) {
      throw new BillingError('SUBSCRIPTION_ORDER_METADATA_INVALID', 'Subscription order metadata invalid', {
        orderId: order.id,
      });
    }

    return { startsAt, validUntil };
  }

  if (order.orderType === 'subscription_upgrade') {
    const currentPeriodEnd = readSubscriptionOrderDate(order, 'currentPeriodEnd');

    if (!currentPeriodEnd) {
      throw new BillingError('SUBSCRIPTION_ORDER_METADATA_INVALID', 'Subscription order metadata invalid', {
        key: 'currentPeriodEnd',
        orderId: order.id,
      });
    }

    return { startsAt: activatedAt, validUntil: currentPeriodEnd };
  }

  return {
    startsAt: activatedAt,
    validUntil: getSubscriptionValidUntil({
      now: activatedAt,
      period: order.period === 'year' ? 'year' : 'month',
    }),
  };
};

const getSubscriptionGrantCycles = (
  order: BillingOrderItem,
  activatedAt: Date,
): Array<{ expiresAt: Date; operationId: string; startsAt: Date }> => {
  const { startsAt, validUntil } = getSubscriptionActivationPeriod(order, activatedAt);
  const cycleCount =
    order.orderType === 'subscription_upgrade'
      ? 1
      : getSubscriptionCycleCount(order.period === 'year' ? 'year' : 'month');

  return Array.from({ length: cycleCount }, (_, index) => {
    const cycleStartsAt = new Date(startsAt.getTime() + index * 30 * 24 * 60 * 60 * 1000);
    const cycleExpiresAt =
      index === cycleCount - 1
        ? validUntil
        : new Date(cycleStartsAt.getTime() + 30 * 24 * 60 * 60 * 1000);

    return {
      expiresAt: cycleExpiresAt,
      operationId:
        cycleCount === 1 ? `subscription:${order.id}` : `subscription:${order.id}:cycle:${index + 1}`,
      startsAt: cycleStartsAt,
    };
  });
};

export class BillingOrderService {
  private readonly orderModel: BillingOrderModel;
  private readonly paymentTransactionModel: PaymentTransactionModel;

  constructor(
    private readonly db: BillingDb,
    private readonly userId: string,
  ) {
    this.orderModel = new BillingOrderModel(db, userId);
    this.paymentTransactionModel = new PaymentTransactionModel(db);
  }

  static forSystem(db: LobeChatDatabase) {
    return {
      async markPaidAndActivate(params: MarkPaidAndActivateParams) {
        const [order] = await db
          .select({ userId: billingOrders.userId })
          .from(billingOrders)
          .where(eq(billingOrders.id, params.orderId))
          .limit(1);

        if (!order) {
          throw new BillingError('BILLING_ORDER_NOT_FOUND', 'Billing order not found', {
            orderId: params.orderId,
          });
        }

        return new BillingOrderService(db, order.userId).markPaidAndActivate(params);
      },
    };
  }

  private createPaymentForOrder = async (params: {
    channel: PaymentChannel;
    description: string;
    order: BillingOrderItem;
  }): Promise<CreatePaymentResult> => {
    try {
      const payment = await getPaymentAdapter(params.channel).createPayment({
        amountCents: params.order.amountCents,
        channel: params.channel,
        description: params.description,
        orderId: params.order.id,
      });

      const transaction = await this.paymentTransactionModel.createPending({
        amountCents: params.order.amountCents,
        billingOrderId: params.order.id,
        channel: params.channel,
        providerTransactionId: payment.transactionId,
      });

      return {
        ...payment,
        transactionId: payment.transactionId ?? transaction.id,
      };
    } catch (error) {
      await this.orderModel.closePending(params.order.id);
      throw error;
    }
  };

  createTopUpOrder = async (params: CreateTopUpOrderParams): Promise<CreateTopUpOrderResult> => {
    const product = TOP_UP_PRODUCTS.find((item) => item.id === params.productId);

    if (!product) {
      throw new BillingError('TOP_UP_PRODUCT_NOT_FOUND', 'Top-up product not found', {
        productId: params.productId,
      });
    }

    const order = await this.orderModel.create({
      amountCents: product.amountCents,
      credits: product.credits,
      currency: BILLING_CURRENCY,
      metadata: {
        priceSource: product.priceSource,
        productId: product.id,
        productName: product.name,
      },
      orderType: 'top_up',
      paymentChannel: params.channel,
      status: 'pending',
    });

    const payment = await this.createPaymentForOrder({
      channel: params.channel,
      description: product.name,
      order,
    });

    return { order, payment };
  };

  createSubscriptionOrder = async (
    params: CreateSubscriptionOrderParams,
  ): Promise<CreateSubscriptionPaymentResult> => {
    const current = await getCurrentSubscription(this.db, this.userId);

    if (current) {
      throw new BillingError(
        'SUBSCRIPTION_ACTIVE',
        'Active subscription should be renewed or upgraded instead',
        {
          currentPlanId: current.planId,
          planId: params.planId,
        },
      );
    }

    const credits = getSubscriptionCredits(params.planId, params.period);
    const plan = SUBSCRIPTION_PLANS[params.planId];
    const order = await this.orderModel.create({
      amountCents: getSubscriptionPriceCents(params.planId, params.period),
      credits,
      currency: BILLING_CURRENCY,
      metadata: {
        planName: plan.name,
        priceSource: TEMPORARY_TEST_PRICE_SOURCE,
      },
      orderType: 'subscription_new',
      paymentChannel: params.channel,
      period: params.period,
      planId: params.planId,
      status: 'pending',
    });
    const payment = await this.createPaymentForOrder({
      channel: params.channel,
      description: `${plan.name} ${params.period} subscription`,
      order,
    });

    return { order, payment };
  };

  createRenewOrder = async (
    params: CreateRenewOrderParams,
  ): Promise<CreateSubscriptionPaymentResult> => {
    const current = await getCurrentSubscription(this.db, this.userId);
    assertCanRenewSubscription({ current, planId: params.planId });

    const validFrom = current!.currentPeriodEnd;
    const validUntil = getSubscriptionValidUntil({
      currentPeriodEnd: validFrom,
      period: params.period,
    });
    const credits = getSubscriptionCredits(params.planId, params.period);
    const plan = SUBSCRIPTION_PLANS[params.planId];
    const order = await this.orderModel.create({
      amountCents: getSubscriptionPriceCents(params.planId, params.period),
      credits,
      currency: BILLING_CURRENCY,
      metadata: {
        currentPeriodEnd: current!.currentPeriodEnd.toISOString(),
        planName: plan.name,
        priceSource: TEMPORARY_TEST_PRICE_SOURCE,
        validFrom: validFrom.toISOString(),
        validUntil: validUntil.toISOString(),
      },
      orderType: 'subscription_renew',
      paymentChannel: params.channel,
      period: params.period,
      planId: params.planId,
      status: 'pending',
    });
    const payment = await this.createPaymentForOrder({
      channel: params.channel,
      description: `${plan.name} ${params.period} renewal`,
      order,
    });

    return { order, payment };
  };

  createUpgradeOrder = async (
    params: CreateUpgradeOrderParams,
  ): Promise<CreateSubscriptionPaymentResult> => {
    const current = await getCurrentSubscription(this.db, this.userId);
    assertCanUpgradeSubscription({ current, targetPlanId: params.targetPlanId });

    const targetPlan = SUBSCRIPTION_PLANS[params.targetPlanId];
    const currentPlan = SUBSCRIPTION_PLANS[current!.planId];
    const credits = targetPlan.creditsPerMonth - currentPlan.creditsPerMonth;
    const order = await this.orderModel.create({
      amountCents: calculateUpgradePriceDelta({
        currentPlanId: current!.planId,
        period: current!.period,
        targetPlanId: params.targetPlanId,
      }),
      credits,
      currency: BILLING_CURRENCY,
      metadata: {
        currentPlanId: current!.planId,
        currentPeriodEnd: current!.currentPeriodEnd.toISOString(),
        planName: targetPlan.name,
        priceSource: TEMPORARY_TEST_PRICE_SOURCE,
      },
      orderType: 'subscription_upgrade',
      paymentChannel: params.channel,
      period: current!.period,
      planId: params.targetPlanId,
      status: 'pending',
    });
    const payment = await this.createPaymentForOrder({
      channel: params.channel,
      description: `${targetPlan.name} subscription upgrade`,
      order,
    });

    return { order, payment };
  };

  cancelPendingOrder = async (orderId: string): Promise<BillingOrderItem> => {
    const order = await this.orderModel.closePending(orderId);

    if (!order) {
      throw new BillingError('BILLING_ORDER_NOT_CANCELABLE', 'Billing order is not cancelable', {
        orderId,
      });
    }

    return order;
  };

  getOrder = (orderId: string): Promise<BillingOrderItem | null> => this.orderModel.findById(orderId);

  listOrders = (params: ListBillingOrdersParams) => this.orderModel.list(params);

  markPaidAndActivate = async (
    params: MarkPaidAndActivateParams,
  ): Promise<{ activated: boolean; orderId: string }> => {
    if (isTransactionalDb(this.db)) {
      return this.db.transaction((tx) => new BillingOrderService(tx, this.userId).activatePaidOrder(params));
    }

    return this.activatePaidOrder(params);
  };

  private activatePaidOrder = async (
    params: MarkPaidAndActivateParams,
  ): Promise<{ activated: boolean; orderId: string }> => {
    const order = await this.orderModel.findById(params.orderId);

    if (!order) {
      throw new BillingError('BILLING_ORDER_NOT_FOUND', 'Billing order not found', {
        orderId: params.orderId,
      });
    }

    if (order.status === 'activated') {
      return { activated: false, orderId: order.id };
    }

    const existingTransaction = await this.paymentTransactionModel.findByProviderTransactionId(
      params.channel,
      params.providerTransactionId,
    );

    if (existingTransaction && existingTransaction.billingOrderId !== order.id) {
      await this.orderModel.updateStatus(order.id, {
        paymentTransactionId: existingTransaction.id,
        status: 'exception',
      });

      throw new BillingError(
        'PAYMENT_TRANSACTION_ORDER_MISMATCH',
        'Payment transaction belongs to another billing order',
        {
          billingOrderId: existingTransaction.billingOrderId,
          orderId: order.id,
          providerTransactionId: params.providerTransactionId,
        },
      );
    }

    if (order.status !== 'pending' && order.status !== 'paid') {
      const transaction = await this.paymentTransactionModel.recordCallback({
        amountCents: params.amountCents,
        amountVerified: params.amountCents === order.amountCents,
        billingOrderId: order.id,
        channel: params.channel,
        providerTransactionId: params.providerTransactionId,
        rawCallback: params.rawCallback,
        signatureVerified: params.signatureVerified,
        status: params.succeeded ? 'succeeded' : 'failed',
      });

      if (params.succeeded) {
        await this.orderModel.updateStatus(order.id, {
          paymentTransactionId: transaction.id,
          status: 'exception',
        });
      }

      return { activated: false, orderId: order.id };
    }

    const amountVerified = params.amountCents === order.amountCents;
    const status = !params.signatureVerified
      ? 'signature_invalid'
      : amountVerified && params.succeeded
        ? 'succeeded'
        : amountVerified
          ? 'failed'
          : 'amount_mismatch';

    const transaction = await this.paymentTransactionModel.recordCallback({
      amountCents: params.amountCents,
      amountVerified,
      billingOrderId: order.id,
      channel: params.channel,
      providerTransactionId: params.providerTransactionId,
      rawCallback: params.rawCallback,
      signatureVerified: params.signatureVerified,
      status,
    });

    if (transaction.billingOrderId !== order.id) {
      await this.orderModel.updateStatus(order.id, {
        paymentTransactionId: transaction.id,
        status: 'exception',
      });

      throw new BillingError(
        'PAYMENT_TRANSACTION_ORDER_MISMATCH',
        'Payment transaction belongs to another billing order',
        {
          billingOrderId: transaction.billingOrderId,
          orderId: order.id,
          providerTransactionId: params.providerTransactionId,
        },
      );
    }

    if (
      transaction.amountCents !== params.amountCents ||
      transaction.channel !== params.channel ||
      transaction.signatureVerified !== params.signatureVerified ||
      transaction.status !== status
    ) {
      await this.orderModel.updateStatus(order.id, {
        paymentTransactionId: transaction.id,
        status: 'exception',
      });

      throw new BillingError('PAYMENT_TRANSACTION_REPLAY_MISMATCH', 'Payment callback replay mismatch', {
        orderId: order.id,
        providerTransactionId: params.providerTransactionId,
      });
    }

    if (!params.signatureVerified || !amountVerified || !params.succeeded) {
      await this.orderModel.updateStatus(order.id, {
        paymentTransactionId: transaction.id,
        status: params.succeeded ? 'exception' : 'failed',
      });

      return { activated: false, orderId: order.id };
    }

    const currentOrder = await this.orderModel.findById(order.id);
    if (!currentOrder || currentOrder.status === 'activated') {
      return { activated: false, orderId: order.id };
    }

    if (currentOrder.status !== 'pending' && currentOrder.status !== 'paid') {
      return { activated: false, orderId: order.id };
    }

    await this.orderModel.updateStatus(order.id, {
      paidAt: new Date(),
      paymentTransactionId: transaction.id,
      status: 'paid',
    });

    const creditsService = new CreditsService(this.db, this.userId);
    let activatedGrantId: string;
    const activatedAt = new Date();
    let activationMetadata: Record<string, unknown> | undefined;

    if (order.orderType === 'top_up') {
      const grant = await creditsService.grantTopUpCredits({
        amountCredits: order.credits,
        billingOrderId: order.id,
        operationId: `top_up:${order.id}`,
      });
      activatedGrantId = grant.id;
    } else {
      const { startsAt, validUntil } = getSubscriptionActivationPeriod(order, activatedAt);
      activationMetadata = {
        ...getOrderMetadata(order),
        validFrom: startsAt.toISOString(),
        validUntil: validUntil.toISOString(),
      };

      const cycles = getSubscriptionGrantCycles(order, activatedAt);
      const grants = [];
      for (const [index, cycle] of cycles.entries()) {
        const grant = await creditsService.grantSubscriptionCredits({
          amountCredits: order.credits,
          billingOrderId: order.id,
          expiresAt: cycle.expiresAt,
          metadata: {
            cycleIndex: index,
            cycleTotal: cycles.length,
            orderType: order.orderType,
            period: order.period,
            planId: order.planId,
          },
          operationId: cycle.operationId,
          startsAt: cycle.startsAt,
        });
        grants.push(grant);
      }
      activatedGrantId = grants[0]!.id;
    }

    await this.orderModel.updateStatus(order.id, {
      activatedAt,
      activatedGrantId,
      ...(activationMetadata ? { metadata: activationMetadata } : {}),
      paymentTransactionId: transaction.id,
      status: 'activated',
    });

    return { activated: true, orderId: order.id };
  };
}
