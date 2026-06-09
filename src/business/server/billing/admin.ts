import { and, asc, desc, eq, isNull, lt, lte, or, sql } from 'drizzle-orm';

import {
  type AdminAuditAction,
  type AdminAuditLogItem,
  adminAuditLogs,
  type BillingOrderItem,
  billingOrders,
  creditAccounts,
  creditGrants,
  creditLedgerEntries,
  type CreditLedgerEntryItem,
  users,
} from '@/database/schemas';
import type { LobeChatDatabase, Transaction } from '@/database/type';

import { CreditsService } from './credits';

interface CreditMutationParams {
  amountCredits: number;
  reason: string;
  targetUserId: string;
}

interface AccountMutationParams {
  reason: string;
  targetUserId: string;
}

interface ListParams {
  cursor?: string;
  pageSize: number;
}

export interface AdminBillingUserItem {
  accountStatus: 'active' | 'frozen' | 'risk';
  availableCredits: number;
  createdAt: Date;
  email: string | null;
  frozenCredits: number;
  id: string;
  lifetimeConsumedCredits: number;
  lifetimeGrantedCredits: number;
  phone: string | null;
  role: string | null;
}

type BillingDb = LobeChatDatabase | Transaction;

const grantPrioritySql = sql`
  case ${creditGrants.source}
    when 'subscription' then 1
    when 'trial' then 2
    when 'top_up' then 3
    when 'admin_grant' then 4
    when 'refund_compensation' then 5
    else 9
  end
`;

const assertSingleRowUpdated = <T>(row: T | undefined, message: string): T => {
  if (!row) throw new Error(message);

  return row;
};

export class AdminBillingService {
  constructor(
    private readonly db: LobeChatDatabase,
    private readonly adminUserId: string,
  ) {}

  private async createAuditLog(
    db: BillingDb,
    params: {
      action: AdminAuditAction;
      amountCredits?: number;
      billingOrderId?: string;
      metadata?: Record<string, unknown>;
      reason: string;
      targetUserId?: string;
    },
  ): Promise<AdminAuditLogItem> {
    const [audit] = await db
      .insert(adminAuditLogs)
      .values({
        action: params.action,
        adminUserId: this.adminUserId,
        amountCredits: params.amountCredits,
        billingOrderId: params.billingOrderId,
        metadata: params.metadata ?? {},
        reason: params.reason,
        targetUserId: params.targetUserId,
      })
      .returning();

    return audit;
  }

  private async ensureAccount(db: BillingDb, targetUserId: string) {
    const [created] = await db
      .insert(creditAccounts)
      .values({ userId: targetUserId })
      .onConflictDoNothing({ target: creditAccounts.userId })
      .returning();

    if (created) return created;

    const [existing] = await db
      .select()
      .from(creditAccounts)
      .where(eq(creditAccounts.userId, targetUserId))
      .limit(1);

    return assertSingleRowUpdated(existing, 'Credit account ensure conflict');
  }

  private async consumeGrantCredits(db: BillingDb, targetUserId: string, amountCredits: number) {
    let remainingToConsume = amountCredits;
    const now = new Date();

    const grants = await db
      .select()
      .from(creditGrants)
      .where(
        and(
          eq(creditGrants.userId, targetUserId),
          eq(creditGrants.status, 'active'),
          sql`${creditGrants.remainingCredits} > 0`,
          or(isNull(creditGrants.startsAt), lte(creditGrants.startsAt, now)),
          or(isNull(creditGrants.expiresAt), sql`${creditGrants.expiresAt} > ${now}`),
        ),
      )
      .orderBy(
        grantPrioritySql,
        sql`${creditGrants.expiresAt} asc nulls last`,
        asc(creditGrants.createdAt),
      );

    for (const grant of grants) {
      if (remainingToConsume <= 0) break;

      const consumedCredits = Math.min(grant.remainingCredits, remainingToConsume);
      const nextRemainingCredits = grant.remainingCredits - consumedCredits;

      const [updatedGrant] = await db
        .update(creditGrants)
        .set({
          remainingCredits: nextRemainingCredits,
          status: nextRemainingCredits === 0 ? 'depleted' : grant.status,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(creditGrants.id, grant.id),
            eq(creditGrants.remainingCredits, grant.remainingCredits),
            eq(creditGrants.status, grant.status),
          ),
        )
        .returning();
      assertSingleRowUpdated(updatedGrant, 'Credit grant consume conflict');

      remainingToConsume -= consumedCredits;
    }
  }

  deductCredits = async (params: CreditMutationParams): Promise<AdminAuditLogItem> => {
    return this.db.transaction(async (tx) => {
      const audit = await this.createAuditLog(tx, {
        action: 'deduct_credits',
        amountCredits: params.amountCredits,
        reason: params.reason,
        targetUserId: params.targetUserId,
      });
      const account = await this.ensureAccount(tx, params.targetUserId);
      const deductedCredits = Math.min(account.availableCredits, params.amountCredits);
      const nextAvailableCredits = account.availableCredits - deductedCredits;
      const nextLifetimeConsumedCredits = account.lifetimeConsumedCredits + deductedCredits;

      await this.consumeGrantCredits(tx, params.targetUserId, deductedCredits);

      const [updatedAccount] = await tx
        .update(creditAccounts)
        .set({
          availableCredits: nextAvailableCredits,
          lifetimeConsumedCredits: nextLifetimeConsumedCredits,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(creditAccounts.id, account.id),
            eq(creditAccounts.availableCredits, account.availableCredits),
            eq(creditAccounts.lifetimeConsumedCredits, account.lifetimeConsumedCredits),
          ),
        )
        .returning();
      assertSingleRowUpdated(updatedAccount, 'Credit account deduct conflict');

      await tx.insert(creditLedgerEntries).values({
        amountCredits: -deductedCredits,
        balanceAfterCredits: nextAvailableCredits,
        eventType: 'adjust',
        metadata: {
          adminAuditLogId: audit.id,
          requestedCredits: params.amountCredits,
        },
        operationId: `admin:deduct:${audit.id}`,
        reason: params.reason,
        userId: params.targetUserId,
      });

      return audit;
    });
  };

  freezeAccount = async (params: AccountMutationParams): Promise<AdminAuditLogItem> => {
    return this.db.transaction(async (tx) => {
      const audit = await this.createAuditLog(tx, {
        action: 'freeze_account',
        reason: params.reason,
        targetUserId: params.targetUserId,
      });
      const account = await this.ensureAccount(tx, params.targetUserId);

      const [updatedAccount] = await tx
        .update(creditAccounts)
        .set({
          riskReason: params.reason,
          status: 'frozen',
          updatedAt: new Date(),
        })
        .where(and(eq(creditAccounts.id, account.id), eq(creditAccounts.status, account.status)))
        .returning();
      assertSingleRowUpdated(updatedAccount, 'Credit account freeze conflict');

      await tx.insert(creditLedgerEntries).values({
        amountCredits: 0,
        balanceAfterCredits: account.availableCredits,
        eventType: 'freeze',
        metadata: { adminAuditLogId: audit.id },
        operationId: `admin:freeze:${audit.id}`,
        reason: params.reason,
        userId: params.targetUserId,
      });

      return audit;
    });
  };

  grantCredits = async (params: CreditMutationParams): Promise<AdminAuditLogItem> => {
    const audit = await this.db.transaction((tx) =>
      this.createAuditLog(tx, {
        action: 'grant_credits',
        amountCredits: params.amountCredits,
        reason: params.reason,
        targetUserId: params.targetUserId,
      }),
    );

    const credits = new CreditsService(this.db, params.targetUserId);
    await credits.grantAdminCredits({
      adminAuditLogId: audit.id,
      amountCredits: params.amountCredits,
      operationId: `admin:grant:${audit.id}`,
      reason: params.reason,
    });

    return audit;
  };

  listAuditLogs = async (
    params: ListParams,
  ): Promise<{ items: AdminAuditLogItem[]; nextCursor?: string }> => {
    const conditions = [];

    if (params.cursor) {
      const [cursorAudit] = await this.db
        .select({ createdAt: adminAuditLogs.createdAt, id: adminAuditLogs.id })
        .from(adminAuditLogs)
        .where(eq(adminAuditLogs.id, params.cursor))
        .limit(1);

      if (cursorAudit) {
        conditions.push(
          or(
            lt(adminAuditLogs.createdAt, cursorAudit.createdAt),
            and(
              eq(adminAuditLogs.createdAt, cursorAudit.createdAt),
              lt(adminAuditLogs.id, cursorAudit.id),
            ),
          )!,
        );
      }
    }

    const items = await this.db
      .select()
      .from(adminAuditLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(adminAuditLogs.createdAt), desc(adminAuditLogs.id))
      .limit(params.pageSize + 1);

    const hasMore = items.length > params.pageSize;
    const pageItems = hasMore ? items.slice(0, params.pageSize) : items;

    return { items: pageItems, nextCursor: hasMore ? pageItems.at(-1)?.id : undefined };
  };

  listLedger = async (
    params: ListParams,
  ): Promise<{ items: CreditLedgerEntryItem[]; nextCursor?: string }> => {
    const conditions = [];

    if (params.cursor) {
      const [cursorLedger] = await this.db
        .select({ createdAt: creditLedgerEntries.createdAt, id: creditLedgerEntries.id })
        .from(creditLedgerEntries)
        .where(eq(creditLedgerEntries.id, params.cursor))
        .limit(1);

      if (cursorLedger) {
        conditions.push(
          or(
            lt(creditLedgerEntries.createdAt, cursorLedger.createdAt),
            and(
              eq(creditLedgerEntries.createdAt, cursorLedger.createdAt),
              lt(creditLedgerEntries.id, cursorLedger.id),
            ),
          )!,
        );
      }
    }

    const items = await this.db
      .select()
      .from(creditLedgerEntries)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(creditLedgerEntries.createdAt), desc(creditLedgerEntries.id))
      .limit(params.pageSize + 1);

    const hasMore = items.length > params.pageSize;
    const pageItems = hasMore ? items.slice(0, params.pageSize) : items;

    return { items: pageItems, nextCursor: hasMore ? pageItems.at(-1)?.id : undefined };
  };

  listOrders = async (
    params: ListParams,
  ): Promise<{ items: BillingOrderItem[]; nextCursor?: string }> => {
    const conditions = [];

    if (params.cursor) {
      const [cursorOrder] = await this.db
        .select({ createdAt: billingOrders.createdAt, id: billingOrders.id })
        .from(billingOrders)
        .where(eq(billingOrders.id, params.cursor))
        .limit(1);

      if (cursorOrder) {
        conditions.push(
          or(
            lt(billingOrders.createdAt, cursorOrder.createdAt),
            and(
              eq(billingOrders.createdAt, cursorOrder.createdAt),
              lt(billingOrders.id, cursorOrder.id),
            ),
          )!,
        );
      }
    }

    const items = await this.db
      .select()
      .from(billingOrders)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(billingOrders.createdAt), desc(billingOrders.id))
      .limit(params.pageSize + 1);

    const hasMore = items.length > params.pageSize;
    const pageItems = hasMore ? items.slice(0, params.pageSize) : items;

    return { items: pageItems, nextCursor: hasMore ? pageItems.at(-1)?.id : undefined };
  };

  listUsers = async (
    params: ListParams,
  ): Promise<{ items: AdminBillingUserItem[]; nextCursor?: string }> => {
    const conditions = [];

    if (params.cursor) {
      const [cursorUser] = await this.db
        .select({ createdAt: users.createdAt, id: users.id })
        .from(users)
        .where(eq(users.id, params.cursor))
        .limit(1);

      if (cursorUser) {
        conditions.push(
          or(
            lt(users.createdAt, cursorUser.createdAt),
            and(eq(users.createdAt, cursorUser.createdAt), lt(users.id, cursorUser.id)),
          )!,
        );
      }
    }

    const items = await this.db
      .select({
        accountStatus: creditAccounts.status,
        availableCredits: creditAccounts.availableCredits,
        createdAt: users.createdAt,
        email: users.email,
        frozenCredits: creditAccounts.frozenCredits,
        id: users.id,
        lifetimeConsumedCredits: creditAccounts.lifetimeConsumedCredits,
        lifetimeGrantedCredits: creditAccounts.lifetimeGrantedCredits,
        phone: users.phone,
        role: users.role,
      })
      .from(users)
      .leftJoin(creditAccounts, eq(creditAccounts.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(users.createdAt), desc(users.id))
      .limit(params.pageSize + 1);

    const hasMore = items.length > params.pageSize;
    const pageItems = (hasMore ? items.slice(0, params.pageSize) : items).map((item) => ({
      accountStatus: item.accountStatus ?? 'active',
      availableCredits: item.availableCredits ?? 0,
      createdAt: item.createdAt,
      email: item.email,
      frozenCredits: item.frozenCredits ?? 0,
      id: item.id,
      lifetimeConsumedCredits: item.lifetimeConsumedCredits ?? 0,
      lifetimeGrantedCredits: item.lifetimeGrantedCredits ?? 0,
      phone: item.phone,
      role: item.role,
    }));

    return { items: pageItems, nextCursor: hasMore ? pageItems.at(-1)?.id : undefined };
  };

  unfreezeAccount = async (params: AccountMutationParams): Promise<AdminAuditLogItem> => {
    return this.db.transaction(async (tx) => {
      const audit = await this.createAuditLog(tx, {
        action: 'unfreeze_account',
        reason: params.reason,
        targetUserId: params.targetUserId,
      });
      const account = await this.ensureAccount(tx, params.targetUserId);

      const [updatedAccount] = await tx
        .update(creditAccounts)
        .set({
          riskReason: null,
          status: 'active',
          updatedAt: new Date(),
        })
        .where(and(eq(creditAccounts.id, account.id), eq(creditAccounts.status, account.status)))
        .returning();
      assertSingleRowUpdated(updatedAccount, 'Credit account unfreeze conflict');

      await tx.insert(creditLedgerEntries).values({
        amountCredits: 0,
        balanceAfterCredits: account.availableCredits,
        eventType: 'unfreeze',
        metadata: { adminAuditLogId: audit.id },
        operationId: `admin:unfreeze:${audit.id}`,
        reason: params.reason,
        userId: params.targetUserId,
      });

      return audit;
    });
  };
}
