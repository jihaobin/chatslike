// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '@/database/core/getTestDB';
import { creditAccounts, creditGrants, creditLedgerEntries, users } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';

import { grantTrialCreditsOnRegistration } from '../trial';

const serverDB: LobeChatDatabase = await getTestDB();
const userId = 'trial-user';

beforeEach(async () => {
  await serverDB.delete(users);
  await serverDB.insert(users).values([{ id: userId }]);
});

afterEach(async () => {
  await serverDB.delete(creditLedgerEntries);
  await serverDB.delete(creditGrants);
  await serverDB.delete(creditAccounts);
  await serverDB.delete(users);
});

describe('grantTrialCreditsOnRegistration', () => {
  it('grants 500000 credits once for a registered user', async () => {
    const first = await grantTrialCreditsOnRegistration(serverDB, { userId });
    const second = await grantTrialCreditsOnRegistration(serverDB, { userId });

    expect(first).toEqual({ credits: 500_000, granted: true });
    expect(second).toEqual({ credits: 500_000, granted: false });

    const rows = await serverDB.select().from(creditGrants);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      operationId: `trial:user:${userId}`,
      remainingCredits: 500_000,
      source: 'trial',
      totalCredits: 500_000,
      userId,
    });
    expect(rows[0].metadata).not.toHaveProperty('phoneNumber');
  });

  it('grants trial credits independently for different users', async () => {
    const otherUserId = 'trial-registration-other';
    await serverDB.insert(users).values([{ id: otherUserId }]);

    const first = await grantTrialCreditsOnRegistration(serverDB, { userId });
    const second = await grantTrialCreditsOnRegistration(serverDB, { userId: otherUserId });

    expect(first.granted).toBe(true);
    expect(second.granted).toBe(true);

    const rows = await serverDB.select().from(creditGrants);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.operationId).sort()).toEqual([
      `trial:user:${otherUserId}`,
      `trial:user:${userId}`,
    ]);
  });
});
