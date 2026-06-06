import { z } from 'zod';

import { BillingOrderService } from '@/business/server/billing/orders';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware/serverDatabase';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const topUpProcedure = authedProcedure.use(serverDatabase).use((opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: {
      billingOrderService: new BillingOrderService(ctx.serverDB, ctx.userId),
    },
  });
});

export const topUpRouter = router({
  cancelOrder: topUpProcedure
    .input(z.object({ orderId: z.string().min(1) }))
    .mutation(({ ctx, input }) => ctx.billingOrderService.cancelPendingOrder(input.orderId)),

  createOrder: topUpProcedure
    .input(
      z.object({
        channel: z.enum(['alipay', 'wechat']),
        productId: z.string().min(1),
      }),
    )
    .mutation(({ ctx, input }) => ctx.billingOrderService.createTopUpOrder(input)),

  getOrder: topUpProcedure
    .input(z.object({ orderId: z.string().min(1) }))
    .query(({ ctx, input }) => ctx.billingOrderService.getOrder(input.orderId)),

  syncOrderPaymentStatus: topUpProcedure
    .input(z.object({ orderId: z.string().min(1) }))
    .query(({ ctx, input }) => ctx.billingOrderService.syncOrderPaymentStatus(input.orderId)),

  listOrders: topUpProcedure
    .input(
      z
        .object({
          cursor: z.string().optional(),
          pageSize: z.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
        })
        .optional(),
    )
    .query(({ ctx, input }) =>
      ctx.billingOrderService.listOrders({
        cursor: input?.cursor,
        pageSize: input?.pageSize ?? DEFAULT_PAGE_SIZE,
      }),
    ),
});
