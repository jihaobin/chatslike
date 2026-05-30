// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';

import { getTestDB } from '@/database/core/getTestDB';
import {
  asyncTasks,
  creditAccounts,
  creditGrants,
  usageRecords,
  users,
} from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';
import { AsyncTaskStatus, AsyncTaskType } from '@/types/asyncTask';

import {
  assertDailyCreditsLimit,
  assertPrechargeRisk,
  getDailyCreditsLimit,
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
    await serverDB.update(users).set({ phoneNumberVerified: true }).where(eq(users.id, userId));

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

  it('blocks precharge before freezing when phone number is not verified', async () => {
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
    ).rejects.toMatchObject({
      code: 'PHONE_VERIFICATION_REQUIRED',
      errorType: 'PHONE_VERIFICATION_REQUIRED',
    });
  });

  it('allows precharge risk checks when phone number is verified', async () => {
    await serverDB.update(users).set({ phoneNumberVerified: true }).where(eq(users.id, userId));

    await expect(
      assertPrechargeRisk({
        db: serverDB,
        estimatedCredits: 100_000,
        userId,
      }),
    ).resolves.toBeUndefined();
  });

  it('blocks precharge before freezing when account is frozen', async () => {
    await serverDB.update(users).set({ phoneNumberVerified: true }).where(eq(users.id, userId));

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
    await serverDB.update(users).set({ phoneNumberVerified: true }).where(eq(users.id, userId));

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
