// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '@/database/core/getTestDB';
import { creditAccounts, creditGrants, creditLedgerEntries, users } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';

import { grantTrialCreditsAfterPhoneVerified } from '../trial';

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

describe('grantTrialCreditsAfterPhoneVerified', () => {
  it('grants 500000 credits once for a verified phone', async () => {
    const first = await grantTrialCreditsAfterPhoneVerified(serverDB, {
      phoneNumber: '+8613800000000',
      userId,
    });
    const second = await grantTrialCreditsAfterPhoneVerified(serverDB, {
      phoneNumber: '+8613800000000',
      userId,
    });

    expect(first.granted).toBe(true);
    expect(second.granted).toBe(false);

    const rows = await serverDB.select().from(creditGrants);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      remainingCredits: 500_000,
      source: 'trial',
      totalCredits: 500_000,
      userId,
    });
    expect(rows[0].expiresAt).toBeInstanceOf(Date);
  });

  it('does not grant trial credits twice for the same phone across users', async () => {
    const otherUserId = 'trial-user-other';
    await serverDB.insert(users).values([{ id: otherUserId }]);

    const first = await grantTrialCreditsAfterPhoneVerified(serverDB, {
      phoneNumber: '+8613800000000',
      userId,
    });
    const second = await grantTrialCreditsAfterPhoneVerified(serverDB, {
      phoneNumber: '+8613800000000',
      userId: otherUserId,
    });

    expect(first.granted).toBe(true);
    expect(second.granted).toBe(false);

    const rows = await serverDB.select().from(creditGrants);
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe(userId);
  });

  it('does not grant trial credits twice when the same phone uses different formats', async () => {
    const otherUserId = 'trial-user-formatted';
    await serverDB.insert(users).values([{ id: otherUserId }]);

    const first = await grantTrialCreditsAfterPhoneVerified(serverDB, {
      phoneNumber: '+8613800000000',
      userId,
    });
    const second = await grantTrialCreditsAfterPhoneVerified(serverDB, {
      phoneNumber: '138 0000-0000',
      userId: otherUserId,
    });

    expect(first.granted).toBe(true);
    expect(second.granted).toBe(false);

    const rows = await serverDB.select().from(creditGrants);
    expect(rows).toHaveLength(1);
    expect(rows[0].operationId).toBe('trial:phone:+8613800000000');
  });
});
