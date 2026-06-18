// @vitest-environment node
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '@/database/core/getTestDB';
import { asyncTasks, creditAccounts, creditGrants, usageRecords, users } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';
import { AsyncTaskStatus, AsyncTaskType } from '@/types/asyncTask';

import {
  assertDailyCreditsLimit,
  assertPrechargeRisk,
  getDailyCreditsLimit,
  isCreditExemptUser,
} from '../risk';

const serverDB: LobeChatDatabase = await getTestDB();
const userId = 'billing-risk-user';

beforeEach(async () => {
  await serverDB.delete(users);
  await serverDB.insert(users).values([{ id: userId }]);
});

afterEach(async () => {
  await serverDB.delete(asyncTasks);
  await serverDB.delete(usageRecords);
  await serverDB.delete(creditGrants);
  await serverDB.delete(creditAccounts);
  await serverDB.delete(users);
});

describe('billing risk', () => {
  it('allows usage below daily limit', () => {
    expect(() =>
      assertDailyCreditsLimit({
        estimatedCredits: 100_000,
        limitCredits: 500_000,
        usedTodayCredits: 200_000,
      }),
    ).not.toThrow();
  });

  it('blocks usage above daily limit', () => {
    expect(() =>
      assertDailyCreditsLimit({
        estimatedCredits: 400_000,
        limitCredits: 500_000,
        usedTodayCredits: 200_000,
      }),
    ).toThrowError('Daily credits limit exceeded');
  });

  it('uses higher daily limit for paid users', () => {
    expect(getDailyCreditsLimit({ hasPaidGrant: false })).toBe(1_000_000);
    expect(getDailyCreditsLimit({ hasPaidGrant: true })).toBe(10_000_000);
  });

  it('blocks precharge before freezing when trial daily usage is exceeded', async () => {
    await serverDB.insert(usageRecords).values({
      actualCredits: 800_000,
      estimatedCredits: 800_000,
      modality: 'text',
      model: 'gpt-4.1',
      provider: 'openai',
      status: 'captured',
      userId,
    });

    await expect(
      assertPrechargeRisk({
        db: serverDB,
        estimatedCredits: 300_000,
        userId,
      }),
    ).rejects.toMatchObject({ code: 'DAILY_CREDITS_LIMIT_EXCEEDED' });
  });

  it('does not require phone verification for AI interactions', async () => {
    await serverDB.insert(creditAccounts).values({
      status: 'active',
      userId,
    });

    await expect(
      assertPrechargeRisk({
        db: serverDB,
        estimatedCredits: 100_000,
        userId,
      }),
    ).resolves.toBeUndefined();
  });

  it('detects admin and super-admin as credit-exempt users', async () => {
    await expect(isCreditExemptUser(serverDB, userId)).resolves.toBe(false);

    await serverDB.update(users).set({ role: 'admin' }).where(eq(users.id, userId));
    await expect(isCreditExemptUser(serverDB, userId)).resolves.toBe(true);

    await serverDB.update(users).set({ role: 'super-admin' }).where(eq(users.id, userId));
    await expect(isCreditExemptUser(serverDB, userId)).resolves.toBe(true);
  });

  it('blocks precharge before freezing when account is frozen', async () => {
    await serverDB.insert(creditAccounts).values({
      status: 'frozen',
      userId,
    });

    await expect(
      assertPrechargeRisk({
        db: serverDB,
        estimatedCredits: 100_000,
        userId,
      }),
    ).rejects.toMatchObject({ code: 'CREDIT_ACCOUNT_FROZEN' });
  });

  it('blocks image and video precharge when generation concurrency is exceeded', async () => {
    await serverDB.insert(asyncTasks).values([
      { status: AsyncTaskStatus.Pending, type: AsyncTaskType.ImageGeneration, userId },
      { status: AsyncTaskStatus.Processing, type: AsyncTaskType.ImageGeneration, userId },
      { status: AsyncTaskStatus.Pending, type: AsyncTaskType.VideoGeneration, userId },
    ]);

    await expect(
      assertPrechargeRisk({
        checkGenerationConcurrency: true,
        db: serverDB,
        estimatedCredits: 100_000,
        userId,
      }),
    ).rejects.toMatchObject({ code: 'GENERATION_CONCURRENCY_LIMIT_EXCEEDED' });
  });
});
