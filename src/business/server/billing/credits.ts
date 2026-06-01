import {
  CreditReservationModel,
  type ListUsageRecordsParams,
  UsageRecordModel,
} from '@/database/models/billing';
import type { LobeChatDatabase, Transaction } from '@/database/type';

import { TRIAL_CREDITS, TRIAL_VALID_DAYS } from './constants';

type BillingDb = LobeChatDatabase | Transaction;

export class CreditsService {
  private readonly model: CreditReservationModel;
  private readonly usageRecordModel: UsageRecordModel;

  constructor(
    private readonly db: BillingDb,
    private readonly userId: string,
  ) {
    this.model = new CreditReservationModel(db, userId);
    this.usageRecordModel = new UsageRecordModel(db, userId);
  }

  getBalance() {
    return this.model.getBalance();
  }

  listGrantPackages() {
    return this.model.listGrantPackages();
  }

  grantTrialCredits(params: { operationId: string; phoneNumber?: string }) {
    const expiresAt = new Date(Date.now() + TRIAL_VALID_DAYS * 24 * 60 * 60 * 1000);

    return this.model.grantCredits({
      amountCredits: TRIAL_CREDITS,
      expiresAt,
      metadata: { phoneNumber: params.phoneNumber, validDays: TRIAL_VALID_DAYS },
      operationId: params.operationId,
      source: 'trial',
    });
  }

  grantTopUpCredits(params: {
    amountCredits: number;
    billingOrderId: string;
    operationId: string;
  }) {
    return this.model.grantCredits({
      amountCredits: params.amountCredits,
      metadata: { billingOrderId: params.billingOrderId },
      operationId: params.operationId,
      source: 'top_up',
    });
  }

  grantSubscriptionCredits(params: {
    amountCredits: number;
    billingOrderId: string;
    expiresAt: Date;
    metadata?: Record<string, unknown>;
    operationId: string;
    startsAt?: Date;
  }) {
    return this.model.grantCredits({
      amountCredits: params.amountCredits,
      expiresAt: params.expiresAt,
      metadata: {
        billingOrderId: params.billingOrderId,
        ...params.metadata,
      },
      operationId: params.operationId,
      source: 'subscription',
      startsAt: params.startsAt,
    });
  }

  grantAdminCredits(params: {
    adminAuditLogId: string;
    amountCredits: number;
    operationId: string;
    reason: string;
  }) {
    return this.model.grantCredits({
      amountCredits: params.amountCredits,
      metadata: {
        adminAuditLogId: params.adminAuditLogId,
        reason: params.reason,
      },
      operationId: params.operationId,
      source: 'admin_grant',
    });
  }

  reserveUsageCredits(params: Parameters<CreditReservationModel['reserveCredits']>[0]) {
    return this.model.reserveCredits(params);
  }

  captureUsageCredits(params: Parameters<CreditReservationModel['captureReservation']>[0]) {
    return this.model.captureReservation(params);
  }

  releaseUsageCredits(params: Parameters<CreditReservationModel['releaseReservation']>[0]) {
    return this.model.releaseReservation(params);
  }

  listUsageRecords(params: ListUsageRecordsParams) {
    return this.usageRecordModel.list(params);
  }

  createUsageRecord(params: Parameters<UsageRecordModel['create']>[0]) {
    return this.usageRecordModel.create(params);
  }
}
