import {
  type AnyPgColumn,
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';

import { idGenerator } from '../utils/idGenerator';
import { amountNumeric, timestamps, timestamptz } from './_helpers';
import { users } from './user';

export type CreditGrantSource =
  | 'trial'
  | 'subscription'
  | 'top_up'
  | 'admin_grant'
  | 'refund_compensation';

export type CreditAccountStatus = 'active' | 'frozen' | 'risk';
export type CreditGrantStatus = 'active' | 'expired' | 'revoked' | 'depleted';
export type CreditReservationStatus =
  | 'pending'
  | 'captured'
  | 'partially_captured'
  | 'released'
  | 'failed'
  | 'exception';
export type CreditLedgerEventType =
  | 'grant'
  | 'reserve'
  | 'capture'
  | 'release'
  | 'adjust'
  | 'refund'
  | 'expire'
  | 'freeze'
  | 'unfreeze';
export type UsageModality = 'text' | 'image' | 'video';
export type BillingOrderType =
  | 'top_up'
  | 'subscription_new'
  | 'subscription_renew'
  | 'subscription_upgrade';
export type BillingOrderStatus =
  | 'pending'
  | 'paid'
  | 'activated'
  | 'closed'
  | 'failed'
  | 'refunded'
  | 'exception';
export type PaymentChannel = 'alipay' | 'wechat';
export type PaymentTransactionStatus =
  | 'created'
  | 'callback_received'
  | 'verified'
  | 'amount_mismatch'
  | 'signature_invalid'
  | 'succeeded'
  | 'failed';
export type AdminAuditAction =
  | 'grant_credits'
  | 'deduct_credits'
  | 'freeze_account'
  | 'unfreeze_account'
  | 'refund_compensation'
  | 'mark_order_exception'
  | 'enterprise_grant'
  | 'platform_catalog_update_provider'
  | 'platform_catalog_update_model'
  | 'platform_catalog_toggle_model'
  | 'platform_catalog_create_pricing'
  | 'platform_catalog_retire_pricing';

export const creditAccounts = pgTable(
  'credit_accounts',
  {
    id: text('id')
      .$defaultFn(() => idGenerator('creditAccounts'))
      .primaryKey()
      .notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    availableCredits: bigint('available_credits', { mode: 'number' }).notNull().default(0),
    frozenCredits: bigint('frozen_credits', { mode: 'number' }).notNull().default(0),
    lifetimeConsumedCredits: bigint('lifetime_consumed_credits', { mode: 'number' })
      .notNull()
      .default(0),
    lifetimeGrantedCredits: bigint('lifetime_granted_credits', { mode: 'number' })
      .notNull()
      .default(0),
    riskReason: text('risk_reason'),
    status: varchar('status', { length: 32 })
      .$type<CreditAccountStatus>()
      .notNull()
      .default('active'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('credit_accounts_user_id_unique').on(t.userId),
    index('credit_accounts_status_idx').on(t.status),
  ],
);

export const creditGrants = pgTable(
  'credit_grants',
  {
    id: text('id')
      .$defaultFn(() => idGenerator('creditGrants'))
      .primaryKey()
      .notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    source: varchar('source', { length: 32 }).$type<CreditGrantSource>().notNull(),
    totalCredits: bigint('total_credits', { mode: 'number' }).notNull(),
    remainingCredits: bigint('remaining_credits', { mode: 'number' }).notNull(),
    startsAt: timestamptz('starts_at'),
    expiresAt: timestamptz('expires_at'),
    billingOrderId: text('billing_order_id').references(() => billingOrders.id, {
      onDelete: 'set null',
    }),
    adminAuditLogId: text('admin_audit_log_id').references(() => adminAuditLogs.id, {
      onDelete: 'set null',
    }),
    operationId: text('operation_id').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    status: varchar('status', { length: 32 })
      .$type<CreditGrantStatus>()
      .notNull()
      .default('active'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('credit_grants_operation_id_unique').on(t.operationId),
    index('credit_grants_user_status_idx').on(t.userId, t.status),
    index('credit_grants_user_source_idx').on(t.userId, t.source),
    index('credit_grants_starts_at_idx').on(t.startsAt),
    index('credit_grants_expires_at_idx').on(t.expiresAt),
  ],
);

export const creditReservations = pgTable(
  'credit_reservations',
  {
    id: text('id')
      .$defaultFn(() => idGenerator('creditReservations'))
      .primaryKey()
      .notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    operationId: text('operation_id').notNull(),
    businessType: varchar('business_type', { length: 32 }).$type<UsageModality>().notNull(),
    businessId: text('business_id'),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    estimatedCredits: bigint('estimated_credits', { mode: 'number' }).notNull(),
    capturedCredits: bigint('captured_credits', { mode: 'number' }).notNull().default(0),
    releasedCredits: bigint('released_credits', { mode: 'number' }).notNull().default(0),
    status: varchar('status', { length: 32 })
      .$type<CreditReservationStatus>()
      .notNull()
      .default('pending'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    capturedAt: timestamptz('captured_at'),
    releasedAt: timestamptz('released_at'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('credit_reservations_operation_id_unique').on(t.operationId),
    index('credit_reservations_user_status_idx').on(t.userId, t.status),
    index('credit_reservations_business_idx').on(t.businessType, t.businessId),
  ],
);

export const creditLedgerEntries = pgTable(
  'credit_ledger_entries',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    eventType: varchar('event_type', { length: 32 }).$type<CreditLedgerEventType>().notNull(),
    amountCredits: bigint('amount_credits', { mode: 'number' }).notNull(),
    balanceAfterCredits: bigint('balance_after_credits', { mode: 'number' }).notNull(),
    grantId: text('grant_id').references(() => creditGrants.id, { onDelete: 'set null' }),
    reservationId: text('reservation_id').references(() => creditReservations.id, {
      onDelete: 'set null',
    }),
    billingOrderId: text('billing_order_id').references(() => billingOrders.id, {
      onDelete: 'set null',
    }),
    usageRecordId: text('usage_record_id').references(() => usageRecords.id, {
      onDelete: 'set null',
    }),
    operationId: text('operation_id').notNull(),
    reason: text('reason'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('credit_ledger_user_created_idx').on(t.userId, t.createdAt),
    index('credit_ledger_operation_idx').on(t.operationId),
    index('credit_ledger_event_type_idx').on(t.eventType),
  ],
);

export const modelPricing = pgTable(
  'model_pricing',
  {
    id: text('id')
      .$defaultFn(() => idGenerator('modelPricing'))
      .primaryKey()
      .notNull(),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    modality: varchar('modality', { length: 32 }).$type<UsageModality>().notNull(),
    priceKey: text('price_key').notNull().default('default'),
    inputCreditsPerMillionTokens: bigint('input_credits_per_million_tokens', {
      mode: 'number',
    }),
    outputCreditsPerMillionTokens: bigint('output_credits_per_million_tokens', {
      mode: 'number',
    }),
    fixedCreditsPerUnit: bigint('fixed_credits_per_unit', { mode: 'number' }),
    unit: varchar('unit', { length: 32 }),
    parameterRules: jsonb('parameter_rules').$type<Record<string, unknown>>().default({}),
    providerCost: amountNumeric('provider_cost'),
    sellRate: amountNumeric('sell_rate'),
    currency: varchar('currency', { length: 8 }).notNull().default('CNY'),
    effectiveAt: timestamptz('effective_at').notNull().defaultNow(),
    status: varchar('status', { length: 32 }).notNull().default('active'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('model_pricing_provider_model_modality_price_key_unique').on(
      t.provider,
      t.model,
      t.modality,
      t.priceKey,
    ),
    index('model_pricing_status_idx').on(t.status),
  ],
);

export const billingOrders = pgTable(
  'billing_orders',
  {
    id: text('id')
      .$defaultFn(() => idGenerator('billingOrders'))
      .primaryKey()
      .notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    orderType: varchar('order_type', { length: 32 }).$type<BillingOrderType>().notNull(),
    status: varchar('status', { length: 32 })
      .$type<BillingOrderStatus>()
      .notNull()
      .default('pending'),
    amountCents: integer('amount_cents').notNull(),
    currency: varchar('currency', { length: 8 }).notNull().default('CNY'),
    credits: bigint('credits', { mode: 'number' }).notNull().default(0),
    planId: varchar('plan_id', { length: 32 }),
    period: varchar('period', { length: 16 }),
    paymentChannel: varchar('payment_channel', { length: 32 }).$type<PaymentChannel>(),
    paymentTransactionId: text('payment_transaction_id').references(
      (): AnyPgColumn => paymentTransactions.id,
      { onDelete: 'set null' },
    ),
    activatedGrantId: text('activated_grant_id').references((): AnyPgColumn => creditGrants.id, {
      onDelete: 'set null',
    }),
    paidAt: timestamptz('paid_at'),
    activatedAt: timestamptz('activated_at'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    ...timestamps,
  },
  (t) => [
    index('billing_orders_user_created_idx').on(t.userId, t.createdAt),
    index('billing_orders_status_idx').on(t.status),
  ],
);

export const paymentTransactions = pgTable(
  'payment_transactions',
  {
    id: text('id')
      .$defaultFn(() => idGenerator('paymentTransactions'))
      .primaryKey()
      .notNull(),
    billingOrderId: text('billing_order_id')
      .notNull()
      .references((): AnyPgColumn => billingOrders.id, { onDelete: 'cascade' }),
    channel: varchar('channel', { length: 32 }).$type<PaymentChannel>().notNull(),
    providerTransactionId: text('provider_transaction_id'),
    status: varchar('status', { length: 32 })
      .$type<PaymentTransactionStatus>()
      .notNull()
      .default('created'),
    amountCents: integer('amount_cents').notNull(),
    rawCallback: jsonb('raw_callback').$type<Record<string, unknown>>(),
    signatureVerified: boolean('signature_verified').notNull().default(false),
    amountVerified: boolean('amount_verified').notNull().default(false),
    callbackReceivedAt: timestamptz('callback_received_at'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    ...timestamps,
  },
  (t) => [
    index('payment_transactions_order_idx').on(t.billingOrderId),
    uniqueIndex('payment_transactions_provider_tx_unique').on(t.channel, t.providerTransactionId),
  ],
);

export const usageRecords = pgTable(
  'usage_records',
  {
    id: text('id')
      .$defaultFn(() => idGenerator('usageRecords'))
      .primaryKey()
      .notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    modality: varchar('modality', { length: 32 }).$type<UsageModality>().notNull(),
    businessId: text('business_id'),
    reservationId: text('reservation_id').references(() => creditReservations.id, {
      onDelete: 'set null',
    }),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    estimatedCredits: bigint('estimated_credits', { mode: 'number' }).notNull().default(0),
    actualCredits: bigint('actual_credits', { mode: 'number' }).notNull().default(0),
    releasedCredits: bigint('released_credits', { mode: 'number' }).notNull().default(0),
    overrunCredits: bigint('overrun_credits', { mode: 'number' }).notNull().default(0),
    providerRequestId: text('provider_request_id'),
    status: varchar('status', { length: 32 }).notNull(),
    params: jsonb('params').$type<Record<string, unknown>>().default({}),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('usage_records_user_created_idx').on(t.userId, t.createdAt),
    index('usage_records_modality_idx').on(t.modality),
    index('usage_records_business_idx').on(t.modality, t.businessId),
  ],
);

export const adminAuditLogs = pgTable(
  'admin_audit_logs',
  {
    id: text('id')
      .$defaultFn(() => idGenerator('adminAuditLogs'))
      .primaryKey()
      .notNull(),
    adminUserId: text('admin_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    targetUserId: text('target_user_id').references(() => users.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 64 }).$type<AdminAuditAction>().notNull(),
    amountCredits: bigint('amount_credits', { mode: 'number' }),
    billingOrderId: text('billing_order_id').references(() => billingOrders.id, {
      onDelete: 'set null',
    }),
    reason: text('reason').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('admin_audit_logs_admin_created_idx').on(t.adminUserId, t.createdAt),
    index('admin_audit_logs_target_created_idx').on(t.targetUserId, t.createdAt),
    index('admin_audit_logs_action_idx').on(t.action),
  ],
);

export const insertCreditAccountSchema = createInsertSchema(creditAccounts);
export const insertCreditGrantSchema = createInsertSchema(creditGrants);
export const insertCreditReservationSchema = createInsertSchema(creditReservations);
export const insertCreditLedgerEntrySchema = createInsertSchema(creditLedgerEntries);
export const insertModelPricingSchema = createInsertSchema(modelPricing);
export const insertBillingOrderSchema = createInsertSchema(billingOrders);
export const insertPaymentTransactionSchema = createInsertSchema(paymentTransactions);
export const insertUsageRecordSchema = createInsertSchema(usageRecords);
export const insertAdminAuditLogSchema = createInsertSchema(adminAuditLogs);

export type CreditAccountItem = typeof creditAccounts.$inferSelect;
export type NewCreditAccount = typeof creditAccounts.$inferInsert;
export type CreditGrantItem = typeof creditGrants.$inferSelect;
export type NewCreditGrant = typeof creditGrants.$inferInsert;
export type CreditReservationItem = typeof creditReservations.$inferSelect;
export type NewCreditReservation = typeof creditReservations.$inferInsert;
export type CreditLedgerEntryItem = typeof creditLedgerEntries.$inferSelect;
export type NewCreditLedgerEntry = typeof creditLedgerEntries.$inferInsert;
export type ModelPricingItem = typeof modelPricing.$inferSelect;
export type NewModelPricing = typeof modelPricing.$inferInsert;
export type BillingOrderItem = typeof billingOrders.$inferSelect;
export type NewBillingOrder = typeof billingOrders.$inferInsert;
export type PaymentTransactionItem = typeof paymentTransactions.$inferSelect;
export type NewPaymentTransaction = typeof paymentTransactions.$inferInsert;
export type UsageRecordItem = typeof usageRecords.$inferSelect;
export type NewUsageRecord = typeof usageRecords.$inferInsert;
export type AdminAuditLogItem = typeof adminAuditLogs.$inferSelect;
export type NewAdminAuditLog = typeof adminAuditLogs.$inferInsert;
