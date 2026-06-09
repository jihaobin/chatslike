// @vitest-environment node
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '@/database/core/getTestDB';
import {
  adminAuditLogs,
  creditAccounts,
  creditGrants,
  creditLedgerEntries,
  users,
} from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';

import { AdminBillingService } from '../admin';

const serverDB: LobeChatDatabase = await getTestDB();
const adminUserId = 'super-admin';
const targetUserId = 'target-user';

const clearBillingData = async () => {
  await serverDB.delete(adminAuditLogs);
  await serverDB.delete(creditLedgerEntries);
  await serverDB.delete(creditGrants);
  await serverDB.delete(creditAccounts);
  await serverDB.delete(users);
};

beforeEach(async () => {
  await clearBillingData();
  await serverDB.insert(users).values([
    { id: adminUserId, role: 'admin' },
    { email: 'target@example.com', id: targetUserId },
  ]);
});

afterEach(async () => {
  await clearBillingData();
});

describe('AdminBillingService', () => {
  it('lists users with credit account status and balance aggregates only', async () => {
    const service = new AdminBillingService(serverDB, adminUserId);
    await serverDB.insert(creditAccounts).values({
      availableCredits: 100_000,
      frozenCredits: 20_000,
      lifetimeConsumedCredits: 30_000,
      lifetimeGrantedCredits: 150_000,
      status: 'risk',
      userId: targetUserId,
    });

    const result = await service.listUsers({ pageSize: 20 });
    const target = result.items.find((item) => item.id === targetUserId);

    expect(target).toMatchObject({
      accountStatus: 'risk',
      availableCredits: 100_000,
      email: 'target@example.com',
      frozenCredits: 20_000,
      id: targetUserId,
      lifetimeConsumedCredits: 30_000,
      lifetimeGrantedCredits: 150_000,
      phone: null,
      role: null,
    });
    expect(target).not.toHaveProperty('preference');
    expect(target).not.toHaveProperty('emailVerified');

    const admin = result.items.find((item) => item.id === adminUserId);
    expect(admin).toMatchObject({
      accountStatus: 'active',
      availableCredits: 0,
      frozenCredits: 0,
      id: adminUserId,
      lifetimeConsumedCredits: 0,
      lifetimeGrantedCredits: 0,
    });
  });

  it('grants credits manually and writes audit log, grant, account, and ledger', async () => {
    const service = new AdminBillingService(serverDB, adminUserId);

    await service.grantCredits({
      amountCredits: 100_000,
      reason: 'manual compensation',
      targetUserId,
    });

    const audits = await serverDB.select().from(adminAuditLogs);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      action: 'grant_credits',
      adminUserId,
      amountCredits: 100_000,
      reason: 'manual compensation',
      targetUserId,
    });

    const [account] = await serverDB
      .select()
      .from(creditAccounts)
      .where(eq(creditAccounts.userId, targetUserId));
    expect(account.availableCredits).toBe(100_000);

    const [grant] = await serverDB.select().from(creditGrants);
    expect(grant).toMatchObject({
      remainingCredits: 100_000,
      source: 'admin_grant',
      totalCredits: 100_000,
      userId: targetUserId,
    });

    const [ledger] = await serverDB.select().from(creditLedgerEntries);
    expect(ledger).toMatchObject({
      amountCredits: 100_000,
      balanceAfterCredits: 100_000,
      eventType: 'grant',
      userId: targetUserId,
    });
  });

  it('deducts credits manually and writes an adjustment ledger entry', async () => {
    const service = new AdminBillingService(serverDB, adminUserId);
    await service.grantCredits({
      amountCredits: 100_000,
      reason: 'manual compensation',
      targetUserId,
    });

    await service.deductCredits({
      amountCredits: 40_000,
      reason: 'manual correction',
      targetUserId,
    });

    const [account] = await serverDB
      .select()
      .from(creditAccounts)
      .where(eq(creditAccounts.userId, targetUserId));
    expect(account.availableCredits).toBe(60_000);

    const ledgers = await serverDB
      .select()
      .from(creditLedgerEntries)
      .where(eq(creditLedgerEntries.eventType, 'adjust'));
    expect(ledgers[0]).toMatchObject({
      amountCredits: -40_000,
      balanceAfterCredits: 60_000,
      reason: 'manual correction',
      userId: targetUserId,
    });
  });

  it('freezes and unfreezes a credit account with audit logs', async () => {
    const service = new AdminBillingService(serverDB, adminUserId);

    await service.freezeAccount({ reason: 'risk review', targetUserId });
    await service.unfreezeAccount({ reason: 'risk cleared', targetUserId });

    const [account] = await serverDB
      .select()
      .from(creditAccounts)
      .where(eq(creditAccounts.userId, targetUserId));
    expect(account.status).toBe('active');
    expect(account.riskReason).toBeNull();

    const audits = await serverDB
      .select()
      .from(adminAuditLogs)
      .where(eq(adminAuditLogs.targetUserId, targetUserId));
    expect(audits.map((audit) => audit.action)).toEqual(['freeze_account', 'unfreeze_account']);
  });

  it('creates the credit account idempotently when first admin mutations run concurrently', async () => {
    const service = new AdminBillingService(serverDB, adminUserId);

    await expect(
      Promise.all([
        service.freezeAccount({ reason: 'risk review', targetUserId }),
        service.unfreezeAccount({ reason: 'risk cleared', targetUserId }),
      ]),
    ).resolves.toHaveLength(2);

    const accounts = await serverDB
      .select()
      .from(creditAccounts)
      .where(eq(creditAccounts.userId, targetUserId));
    expect(accounts).toHaveLength(1);
  });
});
