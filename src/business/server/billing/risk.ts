import { and, count, eq, gte, inArray, isNull, lte, ne, or, sql } from 'drizzle-orm';

import { isAdminOrSuperAdminRole } from '@/const/authRoles';
import { asyncTasks, creditAccounts, creditGrants, usageRecords, users } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';
import { AsyncTaskStatus, AsyncTaskType } from '@/types/asyncTask';

import { billingEnv } from './env';
import { BillingError } from './errors';

const MAX_RUNNING_GENERATION_TASKS = 3;

export function assertDailyCreditsLimit(params: {
  estimatedCredits: number;
  limitCredits: number;
  usedTodayCredits: number;
}) {
  if (params.usedTodayCredits + params.estimatedCredits > params.limitCredits) {
    throw new BillingError('DAILY_CREDITS_LIMIT_EXCEEDED', 'Daily credits limit exceeded', params);
  }
}

export function assertGenerationConcurrency(params: {
  currentRunningTasks: number;
  maxRunningTasks: number;
}) {
  if (params.currentRunningTasks >= params.maxRunningTasks) {
    throw new BillingError(
      'GENERATION_CONCURRENCY_LIMIT_EXCEEDED',
      'Generation concurrency exceeded',
      params,
    );
  }
}

export function getDailyCreditsLimit(params: { hasPaidGrant: boolean }) {
  return params.hasPaidGrant
    ? billingEnv.limits.paidDailyCredits
    : billingEnv.limits.freeDailyCredits;
}

const getTodayStart = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

export async function getUsedTodayCredits(db: LobeChatDatabase, userId: string): Promise<number> {
  const [result] = await db
    .select({
      totalCredits: sql<number>`coalesce(sum(${usageRecords.actualCredits}), 0)`,
    })
    .from(usageRecords)
    .where(and(eq(usageRecords.userId, userId), gte(usageRecords.createdAt, getTodayStart())));

  return Number(result?.totalCredits ?? 0);
}

export async function hasPaidCreditGrant(db: LobeChatDatabase, userId: string): Promise<boolean> {
  const now = new Date();
  const [grant] = await db
    .select({ id: creditGrants.id })
    .from(creditGrants)
    .where(
      and(
        eq(creditGrants.userId, userId),
        inArray(creditGrants.source, ['subscription', 'top_up']),
        ne(creditGrants.status, 'revoked'),
        or(isNull(creditGrants.startsAt), lte(creditGrants.startsAt, now)),
        or(isNull(creditGrants.expiresAt), sql`${creditGrants.expiresAt} > ${now}`),
      ),
    )
    .limit(1);

  return Boolean(grant);
}

export async function getRunningGenerationTaskCount(
  db: LobeChatDatabase,
  userId: string,
): Promise<number> {
  const [result] = await db
    .select({ total: count() })
    .from(asyncTasks)
    .where(
      and(
        eq(asyncTasks.userId, userId),
        inArray(asyncTasks.type, [AsyncTaskType.ImageGeneration, AsyncTaskType.VideoGeneration]),
        inArray(asyncTasks.status, [AsyncTaskStatus.Pending, AsyncTaskStatus.Processing]),
      ),
    );

  return result?.total ?? 0;
}

/**
 * 管理员 / 超级管理员不受积分约束。
 */
export async function isCreditExemptUser(db: LobeChatDatabase, userId: string): Promise<boolean> {
  const [user] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return isAdminOrSuperAdminRole(user?.role);
}

export async function assertPrechargeRisk(params: {
  checkGenerationConcurrency?: boolean;
  db: LobeChatDatabase;
  estimatedCredits: number;
  userId: string;
}) {
  const [account] = await params.db
    .select({ status: creditAccounts.status })
    .from(creditAccounts)
    .where(eq(creditAccounts.userId, params.userId))
    .limit(1);

  if (account && account.status !== 'active') {
    throw new BillingError('CREDIT_ACCOUNT_FROZEN', 'Credit account is frozen', {
      status: account.status,
      userId: params.userId,
    });
  }

  const [usedTodayCredits, hasPaidGrant] = await Promise.all([
    getUsedTodayCredits(params.db, params.userId),
    hasPaidCreditGrant(params.db, params.userId),
  ]);

  assertDailyCreditsLimit({
    estimatedCredits: params.estimatedCredits,
    limitCredits: getDailyCreditsLimit({ hasPaidGrant }),
    usedTodayCredits,
  });

  if (!params.checkGenerationConcurrency) return;

  assertGenerationConcurrency({
    currentRunningTasks: await getRunningGenerationTaskCount(params.db, params.userId),
    maxRunningTasks: MAX_RUNNING_GENERATION_TASKS,
  });
}
