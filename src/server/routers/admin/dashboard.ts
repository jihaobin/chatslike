import { and, type AnyColumn, count, eq, gte, inArray, sql, sum } from 'drizzle-orm';
import { z } from 'zod';

import { billingOrders, creditReservations, users } from '@/database/schemas';
import { adminProcedure, router } from '@/libs/trpc/lambda';

const monthStart = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};

const periodExpr = (granularity: 'week' | 'month', col: AnyColumn) =>
  sql<string>`to_char(date_trunc('${sql.raw(granularity)}', ${col}), 'YYYY-MM-DD')`;

export const dashboardRouter = router({
  stats: adminProcedure.query(async ({ ctx }) => {
    const start = monthStart();
    const [[total], [newUsers], [revenue], [credits], [abnormal]] = await Promise.all([
      ctx.serverDB.select({ v: count() }).from(users),
      ctx.serverDB.select({ v: count() }).from(users).where(gte(users.createdAt, start)),
      ctx.serverDB
        .select({ v: sum(billingOrders.amountCents) })
        .from(billingOrders)
        .where(
          and(
            inArray(billingOrders.status, ['paid', 'activated']),
            gte(billingOrders.paidAt, start),
          ),
        ),
      ctx.serverDB
        .select({ v: sum(creditReservations.capturedCredits) })
        .from(creditReservations)
        .where(
          and(eq(creditReservations.status, 'captured'), gte(creditReservations.createdAt, start)),
        ),
      ctx.serverDB
        .select({ v: count() })
        .from(billingOrders)
        .where(inArray(billingOrders.status, ['exception', 'failed'])),
    ]);

    return {
      abnormalOrders: abnormal?.v ?? 0,
      creditsConsumedThisMonth: Number(credits?.v ?? 0),
      newUsersThisMonth: newUsers?.v ?? 0,
      revenueThisMonthCents: Number(revenue?.v ?? 0),
      totalUsers: total?.v ?? 0,
    };
  }),

  trends: adminProcedure
    .input(z.object({ granularity: z.enum(['week', 'month']).default('month') }))
    .query(async ({ ctx, input }) => {
      const { granularity } = input;
      const start = new Date();
      if (granularity === 'month') start.setMonth(start.getMonth() - 12);
      else start.setDate(start.getDate() - 84);

      const userPeriod = periodExpr(granularity, users.createdAt);
      const creditPeriod = periodExpr(granularity, creditReservations.createdAt);
      const revenuePeriod = periodExpr(granularity, billingOrders.paidAt);

      const [userTrends, creditTrends, revenueTrends] = await Promise.all([
        ctx.serverDB
          .select({ count: sql<number>`count(*)::int`, period: userPeriod })
          .from(users)
          .where(gte(users.createdAt, start))
          .groupBy(userPeriod)
          .orderBy(userPeriod),
        ctx.serverDB
          .select({
            period: creditPeriod,
            total: sql<number>`coalesce(sum(${creditReservations.capturedCredits}), 0)::bigint`,
          })
          .from(creditReservations)
          .where(
            and(
              eq(creditReservations.status, 'captured'),
              gte(creditReservations.createdAt, start),
            ),
          )
          .groupBy(creditPeriod)
          .orderBy(creditPeriod),
        ctx.serverDB
          .select({
            period: revenuePeriod,
            totalCents: sql<number>`coalesce(sum(${billingOrders.amountCents}), 0)::bigint`,
          })
          .from(billingOrders)
          .where(
            and(
              inArray(billingOrders.status, ['paid', 'activated']),
              gte(billingOrders.paidAt, start),
            ),
          )
          .groupBy(revenuePeriod)
          .orderBy(revenuePeriod),
      ]);

      return { creditTrends, revenueTrends, userTrends };
    }),
});
