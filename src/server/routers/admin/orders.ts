import { and, count, desc, eq, gte, ilike, lte } from 'drizzle-orm';
import { z } from 'zod';

import { billingOrders, users } from '@/database/schemas';
import { adminProcedure, router } from '@/libs/trpc/lambda';

const orderFiltersSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  orderType: z
    .enum(['top_up', 'subscription_new', 'subscription_renew', 'subscription_upgrade'])
    .optional(),
  status: z
    .enum(['pending', 'paid', 'activated', 'closed', 'failed', 'refunded', 'exception'])
    .optional(),
  userEmail: z.string().optional(),
});

const paginatedFiltersSchema = orderFiltersSchema.extend({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

const buildWhere = (f: z.infer<typeof orderFiltersSchema>) => {
  const conds = [];
  if (f.userEmail) conds.push(ilike(users.email, `%${f.userEmail}%`));
  if (f.status) conds.push(eq(billingOrders.status, f.status));
  if (f.orderType) conds.push(eq(billingOrders.orderType, f.orderType));
  if (f.dateFrom) conds.push(gte(billingOrders.createdAt, new Date(f.dateFrom)));
  if (f.dateTo) conds.push(lte(billingOrders.createdAt, new Date(f.dateTo)));
  return conds.length > 0 ? and(...conds) : undefined;
};

const orderSelectFields = {
  amountCents: billingOrders.amountCents,
  createdAt: billingOrders.createdAt,
  credits: billingOrders.credits,
  currency: billingOrders.currency,
  id: billingOrders.id,
  orderType: billingOrders.orderType,
  paidAt: billingOrders.paidAt,
  paymentChannel: billingOrders.paymentChannel,
  status: billingOrders.status,
  updatedAt: billingOrders.updatedAt,
  userEmail: users.email,
  userId: billingOrders.userId,
};

export const ordersRouter = router({
  exportCsv: adminProcedure.input(orderFiltersSchema).query(async ({ ctx, input }) => {
    const where = buildWhere(input);

    const rows = await ctx.serverDB
      .select(orderSelectFields)
      .from(billingOrders)
      .leftJoin(users, eq(users.id, billingOrders.userId))
      .where(where)
      .orderBy(desc(billingOrders.createdAt))
      .limit(10_000);

    const escape = (v: unknown) => `"${String(v ?? '').replaceAll('"', '""')}"`;
    const header =
      'id,userId,userEmail,orderType,status,amountCents,currency,credits,paymentChannel,paidAt,updatedAt,createdAt';
    const lines = rows.map((r) =>
      [
        r.id,
        r.userId,
        r.userEmail,
        r.orderType,
        r.status,
        r.amountCents,
        r.currency,
        r.credits,
        r.paymentChannel,
        r.paidAt?.toISOString(),
        r.updatedAt?.toISOString(),
        r.createdAt?.toISOString(),
      ]
        .map(escape)
        .join(','),
    );
    return [header, ...lines].join('\n');
  }),

  list: adminProcedure.input(paginatedFiltersSchema).query(async ({ ctx, input }) => {
    const { page, pageSize, ...filters } = input;
    const where = buildWhere(filters);

    const [items, [{ total }]] = await Promise.all([
      ctx.serverDB
        .select(orderSelectFields)
        .from(billingOrders)
        .leftJoin(users, eq(users.id, billingOrders.userId))
        .where(where)
        .orderBy(desc(billingOrders.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      ctx.serverDB
        .select({ total: count() })
        .from(billingOrders)
        .leftJoin(users, eq(users.id, billingOrders.userId))
        .where(where),
    ]);

    return { items, page, pageSize, total };
  }),
});
