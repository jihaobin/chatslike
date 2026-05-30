// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '@/database/core/getTestDB';
import {
  creditAccounts,
  creditGrants,
  creditLedgerEntries,
  creditReservations,
  users,
} from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';

import { CreditsService } from '../credits';

const serverDB: LobeChatDatabase = await getTestDB();
const userId = 'credits-service-user';

beforeEach(async () => {
  await serverDB.delete(users);
  await serverDB.insert(users).values([{ id: userId }]);
});

afterEach(async () => {
  await serverDB.delete(creditLedgerEntries);
  await serverDB.delete(creditReservations);
  await serverDB.delete(creditGrants);
  await serverDB.delete(creditAccounts);
  await serverDB.delete(users);
});

describe('CreditsService', () => {
  it('grants trial credits and returns balance', async () => {
    const service = new CreditsService(serverDB, userId);

    await service.grantTrialCredits({ operationId: 'trial:user:phone' });

    await expect(service.getBalance()).resolves.toMatchObject({
      availableCredits: 500_000,
      frozenCredits: 0,
      status: 'active',
    });
  });

  it('reserves and captures text usage', async () => {
    const service = new CreditsService(serverDB, userId);
    await service.grantTrialCredits({ operationId: 'trial:user:phone' });

    const reservation = await service.reserveUsageCredits({
      businessType: 'text',
      estimatedCredits: 100_000,
      model: 'gpt-4.1',
      operationId: 'chat:req',
      provider: 'openai',
    });

    const result = await service.captureUsageCredits({
      actualCredits: 30_000,
      operationId: 'chat:req:capture',
      reservationId: reservation.id,
      usageRecordId: 'usage-1',
    });

    expect(result).toMatchObject({
      capturedCredits: 30_000,
      releasedCredits: 70_000,
      status: 'captured',
    });
  });
});
