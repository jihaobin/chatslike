import { and, asc, desc, eq, isNull, lte, or, sql } from 'drizzle-orm';

import type { CreditGrantItem, CreditReservationItem } from '../../schemas';
import {
  creditAccounts,
  creditGrants,
  creditLedgerEntries,
  creditReservations,
} from '../../schemas';
import type { LobeChatDatabase, Transaction } from '../../type';
import {
  type BillingBalance,
  type CaptureReservationParams,
  CreditAccountFrozenError,
  type CreditGrantSummary,
  type GrantCreditsParams,
  InsufficientCreditsError,
  type ReleaseReservationParams,
  type ReservationCaptureResult,
  type ReserveCreditsParams,
} from './types';

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

const runInTransaction = <T>(db: BillingDb, fn: (tx: BillingDb) => Promise<T>): Promise<T> => {
  if ('transaction' in db && typeof db.transaction === 'function') {
    return db.transaction(fn);
  }

  return fn(db);
};

const assertSingleRowUpdated = <T>(row: T | undefined, message: string): T => {
  if (!row) throw new Error(message);

  return row;
};

export class CreditReservationModel {
  private readonly db: BillingDb;
  private readonly userId: string;

  constructor(db: BillingDb, userId: string) {
    this.db = db;
    this.userId = userId;
  }

  private async ensureAccount(db: BillingDb) {
    const [existing] = await db
      .select()
      .from(creditAccounts)
      .where(eq(creditAccounts.userId, this.userId))
      .limit(1);

    if (existing) return existing;

    const [created] = await db.insert(creditAccounts).values({ userId: this.userId }).returning();

    return created;
  }

  private async insertLedgerEntry(
    db: BillingDb,
    params: {
      amountCredits: number;
      balanceAfterCredits: number;
      billingOrderId?: string | null;
      eventType: typeof creditLedgerEntries.$inferInsert.eventType;
      grantId?: string | null;
      metadata?: Record<string, unknown>;
      operationId: string;
      reason?: string | null;
      reservationId?: string | null;
      usageRecordId?: string | null;
    },
  ) {
    await db.insert(creditLedgerEntries).values({
      amountCredits: params.amountCredits,
      balanceAfterCredits: params.balanceAfterCredits,
      billingOrderId: params.billingOrderId,
      eventType: params.eventType,
      grantId: params.grantId,
      metadata: params.metadata ?? {},
      operationId: params.operationId,
      reason: params.reason,
      reservationId: params.reservationId,
      usageRecordId: params.usageRecordId,
      userId: this.userId,
    });
  }

  private async consumeGrantCredits(db: BillingDb, amountCredits: number) {
    let remainingToConsume = amountCredits;
    const now = new Date();

    const grants = await db
      .select()
      .from(creditGrants)
      .where(
        and(
          eq(creditGrants.userId, this.userId),
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

  private async syncGrantAvailability(db: BillingDb): Promise<typeof creditAccounts.$inferSelect> {
    const account = await this.ensureAccount(db);
    const now = new Date();
    let nextAvailableCredits = account.availableCredits;
    let nextLifetimeGrantedCredits = account.lifetimeGrantedCredits;
    let hasAccountChanges = false;

    const expiredGrants = await db
      .select()
      .from(creditGrants)
      .where(
        and(
          eq(creditGrants.userId, this.userId),
          eq(creditGrants.status, 'active'),
          sql`${creditGrants.remainingCredits} > 0`,
          lte(creditGrants.expiresAt, now),
        ),
      )
      .orderBy(asc(creditGrants.expiresAt), asc(creditGrants.createdAt));

    for (const grant of expiredGrants) {
      const metadata = (grant.metadata as Record<string, unknown> | null) ?? {};
      const wasAvailable =
        metadata.activated !== false && (!grant.startsAt || grant.startsAt <= now);

      if (wasAvailable) {
        nextAvailableCredits = Math.max(0, nextAvailableCredits - grant.remainingCredits);
        hasAccountChanges = true;

        await this.insertLedgerEntry(db, {
          amountCredits: -grant.remainingCredits,
          balanceAfterCredits: nextAvailableCredits,
          billingOrderId: grant.billingOrderId,
          eventType: 'expire',
          grantId: grant.id,
          metadata,
          operationId: `${grant.operationId}:expire`,
        });
      }

      await db
        .update(creditGrants)
        .set({
          status: 'expired',
          updatedAt: now,
        })
        .where(eq(creditGrants.id, grant.id));
    }

    const dueGrants = await db
      .select()
      .from(creditGrants)
      .where(
        and(
          eq(creditGrants.userId, this.userId),
          eq(creditGrants.status, 'active'),
          sql`${creditGrants.remainingCredits} > 0`,
          sql`${creditGrants.startsAt} is not null`,
          lte(creditGrants.startsAt, now),
          or(isNull(creditGrants.expiresAt), sql`${creditGrants.expiresAt} > ${now}`),
          sql`${creditGrants.metadata}->>'activated' = 'false'`,
        ),
      )
      .orderBy(asc(creditGrants.startsAt), asc(creditGrants.createdAt));

    for (const grant of dueGrants) {
      const metadata = (grant.metadata as Record<string, unknown> | null) ?? {};
      nextAvailableCredits += grant.remainingCredits;
      nextLifetimeGrantedCredits += grant.remainingCredits;
      hasAccountChanges = true;

      await db
        .update(creditGrants)
        .set({
          metadata: {
            ...metadata,
            activated: true,
            activatedAt: now.toISOString(),
          },
          updatedAt: now,
        })
        .where(eq(creditGrants.id, grant.id));

      await this.insertLedgerEntry(db, {
        amountCredits: grant.remainingCredits,
        balanceAfterCredits: nextAvailableCredits,
        billingOrderId: grant.billingOrderId,
        eventType: 'grant',
        grantId: grant.id,
        metadata: { ...metadata, activationType: 'scheduled' },
        operationId: `${grant.operationId}:activate`,
      });
    }

    if (!hasAccountChanges) return account;

    const [updatedAccount] = await db
      .update(creditAccounts)
      .set({
        availableCredits: nextAvailableCredits,
        lifetimeGrantedCredits: nextLifetimeGrantedCredits,
        updatedAt: now,
      })
      .where(eq(creditAccounts.id, account.id))
      .returning();

    return assertSingleRowUpdated(updatedAccount, 'Credit account update conflict');
  }

  getBalance = async (): Promise<BillingBalance> => {
    return runInTransaction(this.db, async (tx) => {
      const account = await this.syncGrantAvailability(tx);

      return {
        availableCredits: account.availableCredits,
        frozenCredits: account.frozenCredits,
        lifetimeConsumedCredits: account.lifetimeConsumedCredits,
        lifetimeGrantedCredits: account.lifetimeGrantedCredits,
        status: account.status,
      };
    });
  };

  listGrantPackages = async (): Promise<CreditGrantSummary> => {
    return runInTransaction(this.db, async (tx) => {
      await this.syncGrantAvailability(tx);
      const now = new Date();

      const grants = await tx
        .select({
          billingOrderId: creditGrants.billingOrderId,
          createdAt: creditGrants.createdAt,
          expiresAt: creditGrants.expiresAt,
          id: creditGrants.id,
          remainingCredits: creditGrants.remainingCredits,
          source: creditGrants.source,
          startsAt: creditGrants.startsAt,
          status: creditGrants.status,
          totalCredits: creditGrants.totalCredits,
        })
        .from(creditGrants)
        .where(eq(creditGrants.userId, this.userId))
        .orderBy(desc(creditGrants.createdAt));

      const isAvailable = (grant: (typeof grants)[number]) =>
        grant.status === 'active' &&
        grant.remainingCredits > 0 &&
        (!grant.startsAt || grant.startsAt <= now) &&
        (!grant.expiresAt || grant.expiresAt > now);

      return {
        active: grants.reduce(
          (summary, grant) => {
            if (!isAvailable(grant)) return summary;

            if (grant.source === 'subscription') {
              summary.subscriptionCredits += grant.remainingCredits;
            } else {
              summary.rechargeCredits += grant.remainingCredits;
            }

            summary.totalCredits += grant.remainingCredits;

            return summary;
          },
          {
            rechargeCredits: 0,
            subscriptionCredits: 0,
            totalCredits: 0,
          },
        ),
        packages: grants,
      };
    });
  };

  grantCredits = async (params: GrantCreditsParams): Promise<CreditGrantItem> => {
    return runInTransaction(this.db, async (tx) => {
      const [existing] = await tx
        .select()
        .from(creditGrants)
        .where(eq(creditGrants.operationId, params.operationId))
        .limit(1);

      if (existing) {
        if (existing.userId !== this.userId) {
          throw new Error('Credit grant operation belongs to another user');
        }

        return existing;
      }

      const account = await this.syncGrantAvailability(tx);
      const now = new Date();
      const startsInFuture = params.startsAt ? params.startsAt > now : false;
      const expiredOnArrival = params.expiresAt ? params.expiresAt <= now : false;

      const [grant] = await tx
        .insert(creditGrants)
        .values({
          expiresAt: params.expiresAt,
          metadata: {
            ...params.metadata,
            ...(startsInFuture ? { activated: false } : {}),
          },
          operationId: params.operationId,
          remainingCredits: params.amountCredits,
          source: params.source,
          startsAt: params.startsAt,
          status: expiredOnArrival ? 'expired' : 'active',
          totalCredits: params.amountCredits,
          userId: this.userId,
        })
        .onConflictDoNothing({ target: creditGrants.operationId })
        .returning();

      if (!grant) {
        const [conflicting] = await tx
          .select()
          .from(creditGrants)
          .where(eq(creditGrants.operationId, params.operationId))
          .limit(1);

        if (conflicting) {
          if (conflicting.userId !== this.userId) {
            throw new Error('Credit grant operation belongs to another user');
          }

          return conflicting;
        }

        throw new Error('Credit grant operation conflict could not be resolved');
      }

      if (startsInFuture || expiredOnArrival) return grant;

      const nextAvailableCredits = account.availableCredits + params.amountCredits;
      const nextLifetimeGrantedCredits = account.lifetimeGrantedCredits + params.amountCredits;

      const [updatedAccount] = await tx
        .update(creditAccounts)
        .set({
          availableCredits: nextAvailableCredits,
          lifetimeGrantedCredits: nextLifetimeGrantedCredits,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(creditAccounts.id, account.id),
            eq(creditAccounts.availableCredits, account.availableCredits),
            eq(creditAccounts.lifetimeGrantedCredits, account.lifetimeGrantedCredits),
          ),
        )
        .returning();
      assertSingleRowUpdated(updatedAccount, 'Credit account grant conflict');

      await this.insertLedgerEntry(tx, {
        amountCredits: params.amountCredits,
        balanceAfterCredits: nextAvailableCredits,
        eventType: 'grant',
        grantId: grant.id,
        metadata: params.metadata,
        operationId: params.operationId,
      });

      return grant;
    });
  };

  reserveCredits = async (params: ReserveCreditsParams): Promise<CreditReservationItem> => {
    return runInTransaction(this.db, async (tx) => {
      const [existing] = await tx
        .select()
        .from(creditReservations)
        .where(eq(creditReservations.operationId, params.operationId))
        .limit(1);

      if (existing) return existing;

      const account = await this.syncGrantAvailability(tx);

      if (account.status !== 'active') {
        throw new CreditAccountFrozenError();
      }

      if (account.availableCredits < params.estimatedCredits) {
        throw new InsufficientCreditsError({
          availableCredits: account.availableCredits,
          requiredCredits: params.estimatedCredits,
        });
      }

      const [reservation] = await tx
        .insert(creditReservations)
        .values({
          businessId: params.businessId,
          businessType: params.businessType,
          estimatedCredits: params.estimatedCredits,
          metadata: params.metadata ?? {},
          model: params.model,
          operationId: params.operationId,
          provider: params.provider,
          userId: this.userId,
        })
        .returning();

      const nextAvailableCredits = account.availableCredits - params.estimatedCredits;
      const nextFrozenCredits = account.frozenCredits + params.estimatedCredits;

      const [updatedAccount] = await tx
        .update(creditAccounts)
        .set({
          availableCredits: nextAvailableCredits,
          frozenCredits: nextFrozenCredits,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(creditAccounts.id, account.id),
            eq(creditAccounts.availableCredits, account.availableCredits),
            eq(creditAccounts.frozenCredits, account.frozenCredits),
          ),
        )
        .returning();
      assertSingleRowUpdated(updatedAccount, 'Credit reservation reserve conflict');

      await this.insertLedgerEntry(tx, {
        amountCredits: -params.estimatedCredits,
        balanceAfterCredits: nextAvailableCredits,
        eventType: 'reserve',
        operationId: params.operationId,
        reservationId: reservation.id,
      });

      return reservation;
    });
  };

  captureReservation = async (
    params: CaptureReservationParams,
  ): Promise<ReservationCaptureResult> => {
    return runInTransaction(this.db, async (tx) => {
      const [reservation] = await tx
        .select()
        .from(creditReservations)
        .where(
          and(
            eq(creditReservations.id, params.reservationId),
            eq(creditReservations.userId, this.userId),
          ),
        )
        .limit(1);

      if (!reservation) throw new Error('Credit reservation not found');

      if (reservation.status !== 'pending') {
        return {
          capturedCredits: reservation.capturedCredits,
          releasedCredits: reservation.releasedCredits,
          status: reservation.status,
        };
      }

      const account = await this.ensureAccount(tx);
      const frozenToCapture = Math.min(params.actualCredits, reservation.estimatedCredits);
      const overrunCredits = params.actualCredits - frozenToCapture;

      if (overrunCredits > account.availableCredits) {
        const capturedCredits = reservation.estimatedCredits;
        const nextFrozenCredits = account.frozenCredits - reservation.estimatedCredits;
        const nextLifetimeConsumedCredits = account.lifetimeConsumedCredits + capturedCredits;

        await this.consumeGrantCredits(tx, capturedCredits);

        const [updatedAccount] = await tx
          .update(creditAccounts)
          .set({
            frozenCredits: nextFrozenCredits,
            lifetimeConsumedCredits: nextLifetimeConsumedCredits,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(creditAccounts.id, account.id),
              eq(creditAccounts.frozenCredits, account.frozenCredits),
              eq(creditAccounts.lifetimeConsumedCredits, account.lifetimeConsumedCredits),
            ),
          )
          .returning();
        assertSingleRowUpdated(updatedAccount, 'Credit reservation capture conflict');

        await tx
          .update(creditReservations)
          .set({
            capturedAt: new Date(),
            capturedCredits,
            metadata: {
              ...(reservation.metadata as Record<string, unknown> | null),
              overrunCredits,
            },
            status: 'exception',
            updatedAt: new Date(),
          })
          .where(eq(creditReservations.id, reservation.id));

        await this.insertLedgerEntry(tx, {
          amountCredits: 0,
          balanceAfterCredits: account.availableCredits,
          eventType: 'capture',
          metadata: { overrunCredits },
          operationId: params.operationId,
          reservationId: reservation.id,
          usageRecordId: params.usageRecordId,
        });

        return {
          capturedCredits,
          releasedCredits: 0,
          status: 'exception',
        };
      }

      const releasedCredits = reservation.estimatedCredits - frozenToCapture;
      const nextCapturedAvailableCredits = account.availableCredits - overrunCredits;
      const nextAvailableCredits = account.availableCredits + releasedCredits - overrunCredits;
      const nextFrozenCredits = account.frozenCredits - reservation.estimatedCredits;
      const nextLifetimeConsumedCredits = account.lifetimeConsumedCredits + params.actualCredits;

      await this.consumeGrantCredits(tx, params.actualCredits);

      const [updatedAccount] = await tx
        .update(creditAccounts)
        .set({
          availableCredits: nextAvailableCredits,
          frozenCredits: nextFrozenCredits,
          lifetimeConsumedCredits: nextLifetimeConsumedCredits,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(creditAccounts.id, account.id),
            eq(creditAccounts.availableCredits, account.availableCredits),
            eq(creditAccounts.frozenCredits, account.frozenCredits),
            eq(creditAccounts.lifetimeConsumedCredits, account.lifetimeConsumedCredits),
          ),
        )
        .returning();
      assertSingleRowUpdated(updatedAccount, 'Credit reservation capture conflict');

      await tx
        .update(creditReservations)
        .set({
          capturedAt: new Date(),
          capturedCredits: params.actualCredits,
          releasedAt: releasedCredits > 0 ? new Date() : null,
          releasedCredits,
          status: 'captured',
          updatedAt: new Date(),
        })
        .where(eq(creditReservations.id, reservation.id));

      await this.insertLedgerEntry(tx, {
        amountCredits: -overrunCredits,
        balanceAfterCredits: nextCapturedAvailableCredits,
        eventType: 'capture',
        operationId: params.operationId,
        reservationId: reservation.id,
        usageRecordId: params.usageRecordId,
      });

      if (releasedCredits > 0) {
        await this.insertLedgerEntry(tx, {
          amountCredits: releasedCredits,
          balanceAfterCredits: nextAvailableCredits,
          eventType: 'release',
          operationId: `${params.operationId}:release`,
          reservationId: reservation.id,
          usageRecordId: params.usageRecordId,
        });
      }

      return {
        capturedCredits: params.actualCredits,
        releasedCredits,
        status: 'captured',
      };
    });
  };

  releaseReservation = async (params: ReleaseReservationParams): Promise<void> => {
    await runInTransaction(this.db, async (tx) => {
      const [reservation] = await tx
        .select()
        .from(creditReservations)
        .where(
          and(
            eq(creditReservations.id, params.reservationId),
            eq(creditReservations.userId, this.userId),
          ),
        )
        .limit(1);

      if (!reservation) throw new Error('Credit reservation not found');
      if (reservation.status !== 'pending') return;

      const account = await this.ensureAccount(tx);
      const nextAvailableCredits = account.availableCredits + reservation.estimatedCredits;
      const nextFrozenCredits = account.frozenCredits - reservation.estimatedCredits;

      const [updatedAccount] = await tx
        .update(creditAccounts)
        .set({
          availableCredits: nextAvailableCredits,
          frozenCredits: nextFrozenCredits,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(creditAccounts.id, account.id),
            eq(creditAccounts.availableCredits, account.availableCredits),
            eq(creditAccounts.frozenCredits, account.frozenCredits),
          ),
        )
        .returning();
      assertSingleRowUpdated(updatedAccount, 'Credit reservation release conflict');

      await tx
        .update(creditReservations)
        .set({
          releasedAt: new Date(),
          releasedCredits: reservation.estimatedCredits,
          status: 'released',
          updatedAt: new Date(),
        })
        .where(eq(creditReservations.id, reservation.id));

      await this.insertLedgerEntry(tx, {
        amountCredits: reservation.estimatedCredits,
        balanceAfterCredits: nextAvailableCredits,
        eventType: 'release',
        operationId: params.operationId,
        reason: params.reason,
        reservationId: reservation.id,
      });
    });
  };
}
