import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { AdminBillingService } from '@/business/server/billing/admin';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware/serverDatabase';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const SUPER_ADMIN_ROLE = 'super-admin';

const listInputSchema = z
  .object({
    cursor: z.string().optional(),
    pageSize: z.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  })
  .optional();

const creditMutationSchema = z.object({
  amountCredits: z.number().int().positive(),
  reason: z.string().min(1),
  targetUserId: z.string().min(1),
});

const accountMutationSchema = z.object({
  reason: z.string().min(1),
  targetUserId: z.string().min(1),
});

const adminBillingProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;
  const user = await ctx.serverDB.query.users.findFirst({
    columns: { id: true, role: true },
    where: (table, { eq }) => eq(table.id, ctx.userId),
  });

  if (user?.role !== SUPER_ADMIN_ROLE) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Admin billing access is restricted to super administrators',
    });
  }

  return opts.next({
    ctx: {
      adminBillingService: new AdminBillingService(ctx.serverDB, ctx.userId),
    },
  });
});

const normalizeListInput = (input: z.infer<typeof listInputSchema>) => ({
  cursor: input?.cursor,
  pageSize: input?.pageSize ?? DEFAULT_PAGE_SIZE,
});

export const adminBillingRouter = router({
  deductCredits: adminBillingProcedure
    .input(creditMutationSchema)
    .mutation(({ ctx, input }) => ctx.adminBillingService.deductCredits(input)),

  freezeAccount: adminBillingProcedure
    .input(accountMutationSchema)
    .mutation(({ ctx, input }) => ctx.adminBillingService.freezeAccount(input)),

  grantCredits: adminBillingProcedure
    .input(creditMutationSchema)
    .mutation(({ ctx, input }) => ctx.adminBillingService.grantCredits(input)),

  listAuditLogs: adminBillingProcedure
    .input(listInputSchema)
    .query(({ ctx, input }) => ctx.adminBillingService.listAuditLogs(normalizeListInput(input))),

  listLedger: adminBillingProcedure
    .input(listInputSchema)
    .query(({ ctx, input }) => ctx.adminBillingService.listLedger(normalizeListInput(input))),

  listOrders: adminBillingProcedure
    .input(listInputSchema)
    .query(({ ctx, input }) => ctx.adminBillingService.listOrders(normalizeListInput(input))),

  listUsers: adminBillingProcedure
    .input(listInputSchema)
    .query(({ ctx, input }) => ctx.adminBillingService.listUsers(normalizeListInput(input))),

  unfreezeAccount: adminBillingProcedure
    .input(accountMutationSchema)
    .mutation(({ ctx, input }) => ctx.adminBillingService.unfreezeAccount(input)),
});
