import { and, count, desc, eq, gte, ilike, lte } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { z } from 'zod';

import { adminOperationLogs, users } from '@/database/schemas';
import { router, superAdminProcedure } from '@/libs/trpc/lambda';

const auditFiltersSchema = z.object({
  action: z
    .enum(['credit_grant', 'credit_revoke', 'batch_credit_grant', 'account_ban', 'account_unban'])
    .optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  operatorEmail: z.string().optional(),
  targetEmail: z.string().optional(),
});

const paginatedFiltersSchema = auditFiltersSchema.extend({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

export const auditRouter = router({
  list: superAdminProcedure.input(paginatedFiltersSchema).query(async ({ ctx, input }) => {
    const { page, pageSize, action, dateFrom, dateTo, operatorEmail, targetEmail } = input;

    const operator = alias(users, 'operator');
    const target = alias(users, 'target');

    const conds = [];
    if (action) conds.push(eq(adminOperationLogs.action, action));
    if (dateFrom) conds.push(gte(adminOperationLogs.createdAt, new Date(dateFrom)));
    if (dateTo) conds.push(lte(adminOperationLogs.createdAt, new Date(dateTo)));
    if (operatorEmail) conds.push(ilike(operator.email, `%${operatorEmail}%`));
    if (targetEmail) conds.push(ilike(target.email, `%${targetEmail}%`));
    const where = conds.length > 0 ? and(...conds) : undefined;

    const baseQuery = () =>
      ctx.serverDB
        .select({
          action: adminOperationLogs.action,
          afterValue: adminOperationLogs.afterValue,
          beforeValue: adminOperationLogs.beforeValue,
          createdAt: adminOperationLogs.createdAt,
          id: adminOperationLogs.id,
          note: adminOperationLogs.note,
          operatorEmail: operator.email,
          operatorId: adminOperationLogs.operatorId,
          targetEmail: target.email,
          targetUserId: adminOperationLogs.targetUserId,
        })
        .from(adminOperationLogs)
        .leftJoin(operator, eq(operator.id, adminOperationLogs.operatorId))
        .leftJoin(target, eq(target.id, adminOperationLogs.targetUserId))
        .where(where);

    const [items, totals] = await Promise.all([
      baseQuery()
        .orderBy(desc(adminOperationLogs.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      ctx.serverDB
        .select({ total: count() })
        .from(adminOperationLogs)
        .leftJoin(operator, eq(operator.id, adminOperationLogs.operatorId))
        .leftJoin(target, eq(target.id, adminOperationLogs.targetUserId))
        .where(where),
    ]);

    return { items, page, pageSize, total: totals[0].total };
  }),
});
