// @vitest-environment node
import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { adminBillingRouter } from '../adminBilling';

const {
  deductCredits,
  freezeAccount,
  grantCredits,
  listAuditLogs,
  listLedger,
  listOrders,
  listUsers,
  mockDb,
  unfreezeAccount,
} = vi.hoisted(() => ({
  deductCredits: vi.fn(),
  freezeAccount: vi.fn(),
  grantCredits: vi.fn(),
  listAuditLogs: vi.fn(),
  listLedger: vi.fn(),
  listOrders: vi.fn(),
  listUsers: vi.fn(),
  mockDb: {
    query: {
      users: {
        findFirst: vi.fn(),
      },
    },
  },
  unfreezeAccount: vi.fn(),
}));

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn(async () => mockDb),
}));

vi.mock('@/business/server/billing/admin', () => ({
  AdminBillingService: vi.fn().mockImplementation(() => ({
    deductCredits,
    freezeAccount,
    grantCredits,
    listAuditLogs,
    listLedger,
    listOrders,
    listUsers,
    unfreezeAccount,
  })),
}));

describe('adminBillingRouter', () => {
  beforeEach(() => {
    mockDb.query.users.findFirst.mockReset();
    deductCredits.mockReset();
    freezeAccount.mockReset();
    grantCredits.mockReset();
    listAuditLogs.mockReset();
    listLedger.mockReset();
    listOrders.mockReset();
    listUsers.mockReset();
    unfreezeAccount.mockReset();
  });

  it('lists users for a super-admin caller', async () => {
    mockDb.query.users.findFirst.mockResolvedValue({ id: 'super-admin-user', role: 'super-admin' });
    listUsers.mockResolvedValue({ items: [{ id: 'target-user' }], nextCursor: undefined });
    const caller = adminBillingRouter.createCaller({ userId: 'super-admin-user' });

    await expect(caller.listUsers({ pageSize: 20 })).resolves.toMatchObject({
      items: [{ id: 'target-user' }],
    });
    expect(listUsers).toHaveBeenCalledWith({ cursor: undefined, pageSize: 20 });
  });

  it('rejects non-admin callers', async () => {
    mockDb.query.users.findFirst.mockResolvedValue({ id: 'normal-user', role: null });
    const caller = adminBillingRouter.createCaller({ userId: 'normal-user' });

    try {
      await caller.listUsers({ pageSize: 20 });
      throw new Error('Expected adminBillingRouter to reject non-admin caller');
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      expect((error as TRPCError).code).toBe('FORBIDDEN');
    }
  });

  it('rejects ordinary admin callers', async () => {
    mockDb.query.users.findFirst.mockResolvedValue({ id: 'admin-user', role: 'admin' });
    const caller = adminBillingRouter.createCaller({ userId: 'admin-user' });

    await expect(caller.listUsers({ pageSize: 20 })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(listUsers).not.toHaveBeenCalled();
  });

  it('grants credits for a super-admin caller', async () => {
    mockDb.query.users.findFirst.mockResolvedValue({ id: 'super-admin-user', role: 'super-admin' });
    grantCredits.mockResolvedValue({ action: 'grant_credits', id: 'audit-1' });
    const caller = adminBillingRouter.createCaller({ userId: 'super-admin-user' });

    await expect(
      caller.grantCredits({
        amountCredits: 100_000,
        reason: 'manual compensation',
        targetUserId: 'target-user',
      }),
    ).resolves.toMatchObject({ action: 'grant_credits', id: 'audit-1' });
    expect(grantCredits).toHaveBeenCalledWith({
      amountCredits: 100_000,
      reason: 'manual compensation',
      targetUserId: 'target-user',
    });
  });
});
