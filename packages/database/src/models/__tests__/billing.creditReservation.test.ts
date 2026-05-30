// @vitest-environment node
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '../../core/getTestDB';
import type { CreditLedgerEventType } from '../../schemas';
import {
  creditAccounts,
  creditGrants,
  creditLedgerEntries,
  creditReservations,
  usageRecords,
  users,
} from '../../schemas';
import type { LobeChatDatabase } from '../../type';
import { CreditReservationModel } from '../billing';

const serverDB: LobeChatDatabase = await getTestDB();
const userId = 'billing-reservation-user';
const ledgerEventOrder: Record<CreditLedgerEventType, number> = {
  adjust: 5,
  capture: 3,
  expire: 7,
  freeze: 8,
  grant: 1,
  refund: 6,
  release: 4,
  reserve: 2,
  unfreeze: 9,
};

beforeEach(async () => {
  await serverDB.delete(users);
  await serverDB.insert(users).values([{ id: userId }]);
});

afterEach(async () => {
  await serverDB.delete(creditLedgerEntries);
  await serverDB.delete(usageRecords);
  await serverDB.delete(creditReservations);
  await serverDB.delete(creditGrants);
  await serverDB.delete(creditAccounts);
  await serverDB.delete(users);
});

describe('CreditReservationModel', () => {
  it('grants credits idempotently by operation id', async () => {
    const model = new CreditReservationModel(serverDB, userId);

    const first = await model.grantCredits({
      amountCredits: 500_000,
      operationId: 'trial:phone:user',
      source: 'trial',
    });
    const second = await model.grantCredits({
      amountCredits: 500_000,
      operationId: 'trial:phone:user',
      source: 'trial',
    });

    expect(second.id).toBe(first.id);

    const grants = await serverDB.select().from(creditGrants);
    expect(grants).toHaveLength(1);

    const [account] = await serverDB
      .select()
      .from(creditAccounts)
      .where(eq(creditAccounts.userId, userId));
    expect(account.availableCredits).toBe(500_000);
    expect(account.lifetimeGrantedCredits).toBe(500_000);

    const ledger = await serverDB.select().from(creditLedgerEntries);
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({
      amountCredits: 500_000,
      eventType: 'grant',
      operationId: 'trial:phone:user',
    });
  });

  it('keeps future credits unavailable until their start time', async () => {
    const model = new CreditReservationModel(serverDB, userId);
    const now = Date.now();

    await model.grantCredits({
      amountCredits: 500_000,
      expiresAt: new Date(now + 60 * 24 * 60 * 60 * 1000),
      operationId: 'subscription:renew-future',
      source: 'subscription',
      startsAt: new Date(now + 30 * 24 * 60 * 60 * 1000),
    });

    await expect(model.getBalance()).resolves.toMatchObject({
      availableCredits: 0,
      lifetimeGrantedCredits: 0,
    });

    await expect(
      model.reserveCredits({
        businessType: 'text',
        estimatedCredits: 1,
        model: 'gpt-4.1',
        operationId: 'chat:req-future',
        provider: 'openai',
      }),
    ).rejects.toMatchObject({
      code: 'INSUFFICIENT_CREDITS',
    });
  });

  it('activates due scheduled credits lazily when balance is read', async () => {
    const model = new CreditReservationModel(serverDB, userId);
    const now = Date.now();

    const grant = await model.grantCredits({
      amountCredits: 500_000,
      expiresAt: new Date(now + 30 * 24 * 60 * 60 * 1000),
      operationId: 'subscription:renew-due',
      source: 'subscription',
      startsAt: new Date(now + 30 * 24 * 60 * 60 * 1000),
    });
    await serverDB
      .update(creditGrants)
      .set({ startsAt: new Date(now - 1000) })
      .where(eq(creditGrants.id, grant.id));

    await expect(model.getBalance()).resolves.toMatchObject({
      availableCredits: 500_000,
      lifetimeGrantedCredits: 500_000,
    });
    await expect(model.getBalance()).resolves.toMatchObject({
      availableCredits: 500_000,
      lifetimeGrantedCredits: 500_000,
    });

    const ledger = await serverDB
      .select()
      .from(creditLedgerEntries)
      .where(eq(creditLedgerEntries.grantId, grant.id));
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({
      amountCredits: 500_000,
      eventType: 'grant',
      operationId: 'subscription:renew-due:activate',
    });
  });

  it('does not reserve expired credits', async () => {
    const model = new CreditReservationModel(serverDB, userId);

    await model.grantCredits({
      amountCredits: 500_000,
      expiresAt: new Date(Date.now() - 1000),
      operationId: 'trial:expired',
      source: 'trial',
    });

    await expect(
      model.reserveCredits({
        businessType: 'text',
        estimatedCredits: 1,
        model: 'gpt-4.1',
        operationId: 'chat:req-expired',
        provider: 'openai',
      }),
    ).rejects.toMatchObject({
      code: 'INSUFFICIENT_CREDITS',
    });
  });

  it('does not return a grant from another user for the same operation id', async () => {
    const model = new CreditReservationModel(serverDB, userId);
    const otherUserId = 'billing-reservation-other-user';
    await serverDB.insert(users).values([{ id: otherUserId }]);

    await model.grantCredits({
      amountCredits: 500_000,
      operationId: 'trial:phone:user',
      source: 'trial',
    });

    const otherModel = new CreditReservationModel(serverDB, otherUserId);
    await expect(
      otherModel.grantCredits({
        amountCredits: 500_000,
        operationId: 'trial:phone:user',
        source: 'trial',
      }),
    ).rejects.toThrow('Credit grant operation belongs to another user');
  });

  it('reserves credits idempotently and captures with release', async () => {
    const model = new CreditReservationModel(serverDB, userId);
    await model.grantCredits({
      amountCredits: 500_000,
      operationId: 'trial:phone:user',
      source: 'trial',
    });

    const reservation = await model.reserveCredits({
      businessType: 'text',
      estimatedCredits: 100_000,
      model: 'gpt-4.1',
      operationId: 'chat:req-1',
      provider: 'openai',
    });

    expect(reservation.status).toBe('pending');
    expect(reservation.estimatedCredits).toBe(100_000);

    const same = await model.reserveCredits({
      businessType: 'text',
      estimatedCredits: 100_000,
      model: 'gpt-4.1',
      operationId: 'chat:req-1',
      provider: 'openai',
    });
    expect(same.id).toBe(reservation.id);

    const [usageRecord] = await serverDB
      .insert(usageRecords)
      .values({
        actualCredits: 40_000,
        estimatedCredits: 100_000,
        modality: 'text',
        model: 'gpt-4.1',
        provider: 'openai',
        reservationId: reservation.id,
        status: 'succeeded',
        userId,
      })
      .returning();

    const captured = await model.captureReservation({
      actualCredits: 40_000,
      operationId: 'chat:req-1:capture',
      reservationId: reservation.id,
      usageRecordId: usageRecord.id,
    });

    expect(captured.status).toBe('captured');
    expect(captured.capturedCredits).toBe(40_000);
    expect(captured.releasedCredits).toBe(60_000);

    const balance = await model.getBalance();
    expect(balance.availableCredits).toBe(460_000);
    expect(balance.frozenCredits).toBe(0);

    const ledger = await serverDB
      .select()
      .from(creditLedgerEntries)
      .where(eq(creditLedgerEntries.userId, userId));
    expect(
      ledger
        .map((item) => item.eventType)
        .sort((a, b) => ledgerEventOrder[a] - ledgerEventOrder[b]),
    ).toEqual(['grant', 'reserve', 'capture', 'release']);

    const chronologicalLedger = [...ledger].sort((a, b) => ledgerEventOrder[a.eventType] - ledgerEventOrder[b.eventType]);
    let replayedBalance = 0;

    for (const entry of chronologicalLedger) {
      replayedBalance += entry.amountCredits;
      expect(entry.balanceAfterCredits).toBe(replayedBalance);
    }
    expect(replayedBalance).toBe(balance.availableCredits);
  });

  it('releases a pending reservation after provider failure', async () => {
    const model = new CreditReservationModel(serverDB, userId);
    await model.grantCredits({
      amountCredits: 200_000,
      operationId: 'trial:phone:user',
      source: 'trial',
    });

    const reservation = await model.reserveCredits({
      businessType: 'image',
      estimatedCredits: 80_000,
      model: 'dall-e-3',
      operationId: 'image:req-1',
      provider: 'openai',
    });

    await model.releaseReservation({
      operationId: 'image:req-1:release',
      reason: 'provider_error',
      reservationId: reservation.id,
    });

    const balance = await model.getBalance();
    expect(balance.availableCredits).toBe(200_000);
    expect(balance.frozenCredits).toBe(0);
  });

  it('throws INSUFFICIENT_CREDITS before freezing when balance is not enough', async () => {
    const model = new CreditReservationModel(serverDB, userId);
    await model.grantCredits({
      amountCredits: 10_000,
      operationId: 'trial:phone:user',
      source: 'trial',
    });

    await expect(
      model.reserveCredits({
        businessType: 'video',
        estimatedCredits: 100_000,
        model: 'video-model',
        operationId: 'video:req-1',
        provider: 'fal',
      }),
    ).rejects.toMatchObject({
      code: 'INSUFFICIENT_CREDITS',
      deficitCredits: 90_000,
      requiredCredits: 100_000,
    });
  });
});
