import { and, eq, isNull } from 'drizzle-orm';

import type {
  NewPaymentTransaction,
  PaymentChannel,
  PaymentTransactionItem,
  PaymentTransactionStatus,
} from '../../schemas';
import { paymentTransactions } from '../../schemas';
import type { LobeChatDatabase, Transaction } from '../../type';

type BillingDb = LobeChatDatabase | Transaction;

const hasProviderTransactionId = (providerTransactionId?: string | null) =>
  typeof providerTransactionId === 'string' && providerTransactionId.length > 0;

export interface CreatePendingPaymentTransactionParams {
  amountCents: number;
  billingOrderId: string;
  channel: PaymentChannel;
  providerTransactionId?: string | null;
}

export interface RecordPaymentCallbackParams {
  amountCents: number;
  amountVerified: boolean;
  billingOrderId: string;
  channel: PaymentChannel;
  providerTransactionId: string;
  rawCallback: Record<string, unknown>;
  signatureVerified: boolean;
  status: PaymentTransactionStatus;
}

export class PaymentTransactionModel {
  private readonly db: BillingDb;

  constructor(db: BillingDb) {
    this.db = db;
  }

  findByProviderTransactionId = async (
    channel: PaymentChannel,
    providerTransactionId: string,
  ): Promise<PaymentTransactionItem | null> => {
    if (!hasProviderTransactionId(providerTransactionId)) return null;

    const [transaction] = await this.db
      .select()
      .from(paymentTransactions)
      .where(
        and(
          eq(paymentTransactions.channel, channel),
          eq(paymentTransactions.providerTransactionId, providerTransactionId),
        ),
      )
      .limit(1);

    return transaction ?? null;
  };

  findCreatedByOrderId = async (
    billingOrderId: string,
    channel: PaymentChannel,
  ): Promise<PaymentTransactionItem | null> => {
    const [transaction] = await this.db
      .select()
      .from(paymentTransactions)
      .where(
        and(
          eq(paymentTransactions.billingOrderId, billingOrderId),
          eq(paymentTransactions.channel, channel),
          eq(paymentTransactions.status, 'created'),
          isNull(paymentTransactions.providerTransactionId),
        ),
      )
      .limit(1);

    return transaction ?? null;
  };

  createPending = async (
    params: CreatePendingPaymentTransactionParams,
  ): Promise<PaymentTransactionItem> => {
    const values: NewPaymentTransaction = {
      amountCents: params.amountCents,
      billingOrderId: params.billingOrderId,
      channel: params.channel,
      providerTransactionId: hasProviderTransactionId(params.providerTransactionId)
        ? params.providerTransactionId
        : null,
      status: 'created',
    };

    const [transaction] = await this.db.insert(paymentTransactions).values(values).returning();

    return transaction;
  };

  recordCallback = async (
    params: RecordPaymentCallbackParams,
  ): Promise<PaymentTransactionItem> => {
    const existing = await this.findByProviderTransactionId(
      params.channel,
      params.providerTransactionId,
    );

    if (existing) {
      if (existing.status !== 'created' || existing.billingOrderId !== params.billingOrderId) {
        return existing;
      }

      const [transaction] = await this.db
        .update(paymentTransactions)
        .set({
          amountCents: params.amountCents,
          amountVerified: params.amountVerified,
          callbackReceivedAt: new Date(),
          rawCallback: params.rawCallback,
          signatureVerified: params.signatureVerified,
          status: params.status,
          updatedAt: new Date(),
        })
        .where(eq(paymentTransactions.id, existing.id))
        .returning();

      return transaction ?? existing;
    }

    const pending = await this.findCreatedByOrderId(params.billingOrderId, params.channel);

    if (pending) {
      const [transaction] = await this.db
        .update(paymentTransactions)
        .set({
          amountCents: params.amountCents,
          amountVerified: params.amountVerified,
          callbackReceivedAt: new Date(),
          providerTransactionId: params.providerTransactionId,
          rawCallback: params.rawCallback,
          signatureVerified: params.signatureVerified,
          status: params.status,
          updatedAt: new Date(),
        })
        .where(eq(paymentTransactions.id, pending.id))
        .returning();

      return transaction ?? pending;
    }

    const values: NewPaymentTransaction = {
      amountCents: params.amountCents,
      amountVerified: params.amountVerified,
      billingOrderId: params.billingOrderId,
      callbackReceivedAt: new Date(),
      channel: params.channel,
      providerTransactionId: params.providerTransactionId,
      rawCallback: params.rawCallback,
      signatureVerified: params.signatureVerified,
      status: params.status,
    };

    const [transaction] = await this.db.insert(paymentTransactions).values(values).returning();

    return transaction;
  };
}
