import { z } from 'zod';

import { BillingOrderService } from '@/business/server/billing/orders';
import { listPublicTextModelPricingRows } from '@/business/server/billing/pricing';
import {
  getCurrentSubscription,
  listSubscriptionPlans,
} from '@/business/server/billing/subscriptions';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware/serverDatabase';

const paymentChannelSchema = z.enum(['alipay', 'wechat']);
const subscriptionPeriodSchema = z.enum(['month', 'year']);
const subscriptionPlanIdSchema = z.enum(['starter', 'premium', 'ultimate']);

const subscriptionProcedure = authedProcedure.use(serverDatabase).use((opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: {
      billingOrderService: new BillingOrderService(ctx.serverDB, ctx.userId),
    },
  });
});

export const subscriptionRouter = router({
  createRenewOrder: subscriptionProcedure
    .input(
      z.object({
        channel: paymentChannelSchema,
        period: subscriptionPeriodSchema,
        planId: subscriptionPlanIdSchema,
      }),
    )
    .mutation(({ ctx, input }) => ctx.billingOrderService.createRenewOrder(input)),

  createSubscriptionOrder: subscriptionProcedure
    .input(
      z.object({
        channel: paymentChannelSchema,
        period: subscriptionPeriodSchema,
        planId: subscriptionPlanIdSchema,
      }),
    )
    .mutation(({ ctx, input }) => ctx.billingOrderService.createSubscriptionOrder(input)),

  createUpgradeOrder: subscriptionProcedure
    .input(
      z.object({
        channel: paymentChannelSchema,
        targetPlanId: subscriptionPlanIdSchema,
      }),
    )
    .mutation(({ ctx, input }) => ctx.billingOrderService.createUpgradeOrder(input)),

  getCurrent: subscriptionProcedure.query(({ ctx }) =>
    getCurrentSubscription(ctx.serverDB, ctx.userId),
  ),

  listPlans: authedProcedure.query(() => listSubscriptionPlans()),

  listTextModelPricing: authedProcedure.query(() => listPublicTextModelPricingRows()),
});
