import { and, count, desc, eq, gte, ilike, isNull, lte, or, sql } from 'drizzle-orm';
import { z } from 'zod';

import { AdminModel } from '@/database/models/admin';
import { adminOperationLogs, creditAccounts, creditGrants, users } from '@/database/schemas';
import { createNanoId } from '@/database/utils/idGenerator';
import { adminProcedure, router } from '@/libs/trpc/lambda';

const userFiltersSchema = z.object({
  banned: z.boolean().optional(),
  createdAtFrom: z.string().optional(),
  createdAtTo: z.string().optional(),
  plan: z.string().optional(),
  search: z.string().optional(),
});

const paginatedFiltersSchema = userFiltersSchema.extend({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

const buildWhere = (f: {
  banned?: boolean;
  createdAtFrom?: string;
  createdAtTo?: string;
  plan?: string;
  search?: string;
}) => {
  const conds = [];
  if (f.search)
    conds.push(or(ilike(users.email, `%${f.search}%`), ilike(users.username, `%${f.search}%`)));
  if (f.banned === true) conds.push(eq(users.banned, true));
  else if (f.banned === false) conds.push(or(eq(users.banned, false), isNull(users.banned)));
  if (f.createdAtFrom) conds.push(gte(users.createdAt, new Date(f.createdAtFrom)));
  if (f.createdAtTo) conds.push(lte(users.createdAt, new Date(f.createdAtTo)));
  if (f.plan)
    conds.push(
      sql`EXISTS (SELECT 1 FROM billing_orders WHERE user_id = users.id AND status = 'activated' AND plan_id = ${f.plan} AND order_type IN ('subscription_new','subscription_renew','subscription_upgrade'))`,
    );
  return conds.length > 0 ? and(...conds) : undefined;
};

const nanoId16 = createNanoId(16);

export const usersRouter = router({
  list: adminProcedure.input(paginatedFiltersSchema).query(async ({ ctx, input }) => {
    const { page, pageSize, ...filters } = input;
    const where = buildWhere(filters);

    const [items, [{ total }]] = await Promise.all([
      ctx.serverDB
        .select({
          avatar: users.avatar,
          banExpires: users.banExpires,
          banReason: users.banReason,
          banned: users.banned,
          createdAt: users.createdAt,
          currentPlan: sql<
            string | null
          >`(SELECT plan_id FROM billing_orders WHERE user_id = users.id AND status = 'activated' AND order_type IN ('subscription_new','subscription_renew','subscription_upgrade') ORDER BY activated_at DESC NULLS LAST LIMIT 1)`,
          email: users.email,
          id: users.id,
          subscriptionCredits: sql<number>`COALESCE((SELECT SUM(remaining_credits) FROM credit_grants WHERE user_id = users.id AND source = 'subscription' AND status = 'active'), 0)::float8`,
          topUpCredits: sql<number>`COALESCE((SELECT SUM(remaining_credits) FROM credit_grants WHERE user_id = users.id AND source = 'top_up' AND status = 'active'), 0)::float8`,
          username: users.username,
        })
        .from(users)
        .where(where)
        .orderBy(desc(users.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      ctx.serverDB.select({ total: count() }).from(users).where(where),
    ]);

    return { items, page, pageSize, total };
  }),

  grantCredit: adminProcedure
    .input(
      z.object({
        amount: z.number().int().positive(),
        expiresAt: z.date().optional(),
        note: z.string().optional(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { userId, amount, expiresAt, note } = input;
      const operationId = `admin_grant_${nanoId16()}`;

      await ctx.serverDB.transaction(async (tx) => {
        await tx.insert(creditGrants).values({
          expiresAt: expiresAt ?? null,
          operationId,
          remainingCredits: amount,
          source: 'admin_grant',
          totalCredits: amount,
          userId,
        });
        await tx
          .insert(creditAccounts)
          .values({ availableCredits: amount, userId })
          .onConflictDoUpdate({
            set: {
              availableCredits: sql`credit_accounts.available_credits + EXCLUDED.available_credits`,
              updatedAt: new Date(),
            },
            target: creditAccounts.userId,
          });
      });

      await new AdminModel(ctx.serverDB, ctx.userId).logOperation({
        action: 'credit_grant',
        afterValue: { amount, expiresAt: expiresAt?.toISOString(), operationId },
        note,
        targetUserId: userId,
      });
    }),

  revokeCredit: adminProcedure
    .input(z.object({ grantId: z.string(), note: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { grantId, note } = input;

      const [grant] = await ctx.serverDB
        .select({ remainingCredits: creditGrants.remainingCredits, userId: creditGrants.userId })
        .from(creditGrants)
        .where(and(eq(creditGrants.id, grantId), eq(creditGrants.status, 'active')));

      if (!grant) throw new Error('Grant not found or already revoked');

      await ctx.serverDB.transaction(async (tx) => {
        await tx
          .update(creditGrants)
          .set({ remainingCredits: 0, status: 'revoked' })
          .where(eq(creditGrants.id, grantId));
        await tx
          .update(creditAccounts)
          .set({
            availableCredits: sql`GREATEST(0, credit_accounts.available_credits - ${grant.remainingCredits})`,
          })
          .where(eq(creditAccounts.userId, grant.userId));
      });

      await new AdminModel(ctx.serverDB, ctx.userId).logOperation({
        action: 'credit_revoke',
        afterValue: { grantId, revokedAmount: grant.remainingCredits },
        note,
        targetUserId: grant.userId,
      });
    }),

  batchGrantCredit: adminProcedure
    .input(
      z.object({
        amount: z.number().int().positive(),
        expiresAt: z.date().optional(),
        note: z.string().optional(),
        userIds: z.array(z.string()).min(1).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { userIds, amount, expiresAt, note } = input;

      await ctx.serverDB.transaction(async (tx) => {
        await tx.insert(creditGrants).values(
          userIds.map((userId) => ({
            expiresAt: expiresAt ?? null,
            operationId: `admin_batch_${nanoId16()}`,
            remainingCredits: amount,
            source: 'admin_grant' as const,
            totalCredits: amount,
            userId,
          })),
        );
        for (const userId of userIds) {
          await tx
            .insert(creditAccounts)
            .values({ availableCredits: amount, userId })
            .onConflictDoUpdate({
              set: {
                availableCredits: sql`credit_accounts.available_credits + EXCLUDED.available_credits`,
                updatedAt: new Date(),
              },
              target: creditAccounts.userId,
            });
        }
      });

      // bulk log insert instead of N individual calls
      await ctx.serverDB.insert(adminOperationLogs).values(
        userIds.map((userId) => ({
          action: 'batch_credit_grant' as const,
          afterValue: { amount, expiresAt: expiresAt?.toISOString() },
          note,
          operatorId: ctx.userId,
          targetUserId: userId,
        })),
      );
    }),

  banUser: adminProcedure
    .input(
      z.object({
        banExpires: z.date().optional(),
        banReason: z.string().optional(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { userId, banReason, banExpires } = input;

      await ctx.serverDB
        .update(users)
        .set({ banExpires: banExpires ?? null, banReason: banReason ?? null, banned: true })
        .where(eq(users.id, userId));

      await new AdminModel(ctx.serverDB, ctx.userId).logOperation({
        action: 'account_ban',
        afterValue: { banExpires: banExpires?.toISOString(), banReason, banned: true },
        targetUserId: userId,
      });
    }),

  unbanUser: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.serverDB
        .update(users)
        .set({ banExpires: null, banReason: null, banned: false })
        .where(eq(users.id, input.userId));

      await new AdminModel(ctx.serverDB, ctx.userId).logOperation({
        action: 'account_unban',
        afterValue: { banned: false },
        targetUserId: input.userId,
      });
    }),

  exportCsv: adminProcedure.input(userFiltersSchema).query(async ({ ctx, input }) => {
    const where = buildWhere(input);

    const rows = await ctx.serverDB
      .select({
        banned: users.banned,
        banReason: users.banReason,
        createdAt: users.createdAt,
        currentPlan: sql<
          string | null
        >`(SELECT plan_id FROM billing_orders WHERE user_id = users.id AND status = 'activated' AND order_type IN ('subscription_new','subscription_renew','subscription_upgrade') ORDER BY activated_at DESC NULLS LAST LIMIT 1)`,
        email: users.email,
        id: users.id,
        subscriptionCredits: sql<number>`COALESCE((SELECT SUM(remaining_credits) FROM credit_grants WHERE user_id = users.id AND source = 'subscription' AND status = 'active'), 0)::float8`,
        topUpCredits: sql<number>`COALESCE((SELECT SUM(remaining_credits) FROM credit_grants WHERE user_id = users.id AND source = 'top_up' AND status = 'active'), 0)::float8`,
        username: users.username,
      })
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(10_000);

    const escape = (v: unknown) => `"${String(v ?? '').replaceAll('"', '""')}"`;
    const header =
      'id,username,email,subscriptionCredits,topUpCredits,currentPlan,banned,banReason,createdAt';
    const lines = rows.map((r) =>
      [
        r.id,
        r.username,
        r.email,
        r.subscriptionCredits,
        r.topUpCredits,
        r.currentPlan ?? '',
        r.banned,
        r.banReason,
        r.createdAt?.toISOString(),
      ]
        .map(escape)
        .join(','),
    );
    return [header, ...lines].join('\n');
  }),
});
