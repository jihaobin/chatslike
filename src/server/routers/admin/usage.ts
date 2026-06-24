import type { AnyColumn } from 'drizzle-orm';
import { and, desc, eq, gte, ilike, lte, sql } from 'drizzle-orm';
import { z } from 'zod';

import { usageRecords, users } from '@/database/schemas';
import { adminProcedure, router } from '@/libs/trpc/lambda';

const periodExpr = (granularity: 'day' | 'week' | 'month', col: AnyColumn) =>
  sql<string>`to_char(date_trunc('${sql.raw(granularity)}', ${col}), 'YYYY-MM-DD')`;

const usageFiltersSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  granularity: z.enum(['day', 'week', 'month']).default('day'),
  modality: z.enum(['text', 'image', 'video']).optional(),
  model: z.string().optional(),
  userEmail: z.string().optional(),
});

const paginatedFiltersSchema = usageFiltersSchema.extend({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

const buildWhere = (f: z.infer<typeof usageFiltersSchema>) => {
  const conds = [];
  if (f.userEmail) conds.push(ilike(users.email, `%${f.userEmail}%`));
  if (f.model) conds.push(ilike(usageRecords.model, `%${f.model}%`));
  if (f.modality) conds.push(eq(usageRecords.modality, f.modality));
  if (f.dateFrom) conds.push(gte(usageRecords.createdAt, new Date(f.dateFrom)));
  if (f.dateTo) conds.push(lte(usageRecords.createdAt, new Date(f.dateTo)));
  return conds.length > 0 ? and(...conds) : undefined;
};

export const usageRouter = router({
  exportCsv: adminProcedure.input(usageFiltersSchema).query(async ({ ctx, input }) => {
    const { granularity } = input;
    const where = buildWhere(input);
    const period = periodExpr(granularity, usageRecords.createdAt);

    const rows = await ctx.serverDB
      .select({
        model: usageRecords.model,
        modality: usageRecords.modality,
        period,
        provider: usageRecords.provider,
        requestCount: sql<number>`count(*)::int`,
        totalActualCredits: sql<number>`sum(${usageRecords.actualCredits})::bigint`,
        totalInputTokens: sql<number>`coalesce(sum(${usageRecords.inputTokens}), 0)::int`,
        totalOutputTokens: sql<number>`coalesce(sum(${usageRecords.outputTokens}), 0)::int`,
        userEmail: users.email,
        userId: usageRecords.userId,
      })
      .from(usageRecords)
      .leftJoin(users, eq(users.id, usageRecords.userId))
      .where(where)
      .groupBy(
        usageRecords.userId,
        usageRecords.model,
        usageRecords.provider,
        usageRecords.modality,
        users.email,
        period,
      )
      .orderBy(period, desc(sql`sum(${usageRecords.actualCredits})`))
      .limit(10_000);

    const escape = (v: unknown) => `"${String(v ?? '').replaceAll('"', '""')}"`;
    const header =
      'userId,userEmail,period,provider,model,modality,requestCount,totalInputTokens,totalOutputTokens,totalActualCredits';
    const lines = rows.map((r) =>
      [
        r.userId,
        r.userEmail,
        r.period,
        r.provider,
        r.model,
        r.modality,
        r.requestCount,
        r.totalInputTokens,
        r.totalOutputTokens,
        r.totalActualCredits,
      ]
        .map(escape)
        .join(','),
    );
    return [header, ...lines].join('\n');
  }),

  list: adminProcedure.input(paginatedFiltersSchema).query(async ({ ctx, input }) => {
    const { page, pageSize, granularity, ...filters } = input;
    const where = buildWhere({ ...filters, granularity });
    const period = periodExpr(granularity, usageRecords.createdAt);

    const groupByCols = [
      usageRecords.userId,
      usageRecords.model,
      usageRecords.provider,
      usageRecords.modality,
      users.email,
      period,
    ] as const;

    const selectFields = {
      model: usageRecords.model,
      modality: usageRecords.modality,
      period,
      provider: usageRecords.provider,
      requestCount: sql<number>`count(*)::int`,
      totalActualCredits: sql<number>`sum(${usageRecords.actualCredits})::bigint`,
      totalInputTokens: sql<number>`coalesce(sum(${usageRecords.inputTokens}), 0)::int`,
      totalOutputTokens: sql<number>`coalesce(sum(${usageRecords.outputTokens}), 0)::int`,
      userEmail: users.email,
      userId: usageRecords.userId,
    };

    const countSub = ctx.serverDB
      .select({ _: sql`1` })
      .from(usageRecords)
      .leftJoin(users, eq(users.id, usageRecords.userId))
      .where(where)
      .groupBy(...groupByCols)
      .as('cg');

    const [items, [{ total }]] = await Promise.all([
      ctx.serverDB
        .select(selectFields)
        .from(usageRecords)
        .leftJoin(users, eq(users.id, usageRecords.userId))
        .where(where)
        .groupBy(...groupByCols)
        .orderBy(period, desc(sql`sum(${usageRecords.actualCredits})`))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      ctx.serverDB.select({ total: sql<number>`count(*)::int` }).from(countSub),
    ]);

    return { items, page, pageSize, total };
  }),
});
