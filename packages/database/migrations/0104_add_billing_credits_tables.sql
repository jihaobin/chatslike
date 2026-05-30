CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"admin_user_id" text NOT NULL,
	"target_user_id" text,
	"action" varchar(64) NOT NULL,
	"amount_credits" bigint,
	"billing_order_id" text,
	"reason" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"order_type" varchar(32) NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" varchar(8) DEFAULT 'CNY' NOT NULL,
	"credits" bigint DEFAULT 0 NOT NULL,
	"plan_id" varchar(32),
	"period" varchar(16),
	"payment_channel" varchar(32),
	"payment_transaction_id" text,
	"activated_grant_id" text,
	"paid_at" timestamp with time zone,
	"activated_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credit_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"available_credits" bigint DEFAULT 0 NOT NULL,
	"frozen_credits" bigint DEFAULT 0 NOT NULL,
	"lifetime_consumed_credits" bigint DEFAULT 0 NOT NULL,
	"lifetime_granted_credits" bigint DEFAULT 0 NOT NULL,
	"risk_reason" text,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credit_grants" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"source" varchar(32) NOT NULL,
	"total_credits" bigint NOT NULL,
	"remaining_credits" bigint NOT NULL,
	"expires_at" timestamp with time zone,
	"billing_order_id" text,
	"admin_audit_log_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credit_ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"event_type" varchar(32) NOT NULL,
	"amount_credits" bigint NOT NULL,
	"balance_after_credits" bigint NOT NULL,
	"grant_id" text,
	"reservation_id" text,
	"billing_order_id" text,
	"usage_record_id" text,
	"operation_id" text NOT NULL,
	"reason" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credit_reservations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"operation_id" text NOT NULL,
	"business_type" varchar(32) NOT NULL,
	"business_id" text,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"estimated_credits" bigint NOT NULL,
	"captured_credits" bigint DEFAULT 0 NOT NULL,
	"released_credits" bigint DEFAULT 0 NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"captured_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "model_pricing" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"modality" varchar(32) NOT NULL,
	"price_key" text DEFAULT 'default' NOT NULL,
	"input_credits_per_million_tokens" bigint,
	"output_credits_per_million_tokens" bigint,
	"fixed_credits_per_unit" bigint,
	"unit" varchar(32),
	"parameter_rules" jsonb DEFAULT '{}'::jsonb,
	"provider_cost" numeric(20, 6),
	"sell_rate" numeric(20, 6),
	"currency" varchar(8) DEFAULT 'CNY' NOT NULL,
	"effective_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"billing_order_id" text NOT NULL,
	"channel" varchar(32) NOT NULL,
	"provider_transaction_id" text,
	"status" varchar(32) DEFAULT 'created' NOT NULL,
	"amount_cents" integer NOT NULL,
	"raw_callback" jsonb,
	"signature_verified" boolean DEFAULT false NOT NULL,
	"amount_verified" boolean DEFAULT false NOT NULL,
	"callback_received_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "usage_records" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"modality" varchar(32) NOT NULL,
	"business_id" text,
	"reservation_id" text,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"estimated_credits" bigint DEFAULT 0 NOT NULL,
	"actual_credits" bigint DEFAULT 0 NOT NULL,
	"released_credits" bigint DEFAULT 0 NOT NULL,
	"overrun_credits" bigint DEFAULT 0 NOT NULL,
	"provider_request_id" text,
	"status" varchar(32) NOT NULL,
	"params" jsonb DEFAULT '{}'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_audit_logs" DROP CONSTRAINT IF EXISTS "admin_audit_logs_admin_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_admin_user_id_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_audit_logs" DROP CONSTRAINT IF EXISTS "admin_audit_logs_target_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_orders" DROP CONSTRAINT IF EXISTS "billing_orders_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "billing_orders" ADD CONSTRAINT "billing_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_accounts" DROP CONSTRAINT IF EXISTS "credit_accounts_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "credit_accounts" ADD CONSTRAINT "credit_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_grants" DROP CONSTRAINT IF EXISTS "credit_grants_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "credit_grants" ADD CONSTRAINT "credit_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_grants" DROP CONSTRAINT IF EXISTS "credit_grants_billing_order_id_billing_orders_id_fk";--> statement-breakpoint
ALTER TABLE "credit_grants" ADD CONSTRAINT "credit_grants_billing_order_id_billing_orders_id_fk" FOREIGN KEY ("billing_order_id") REFERENCES "public"."billing_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_grants" DROP CONSTRAINT IF EXISTS "credit_grants_admin_audit_log_id_admin_audit_logs_id_fk";--> statement-breakpoint
ALTER TABLE "credit_grants" ADD CONSTRAINT "credit_grants_admin_audit_log_id_admin_audit_logs_id_fk" FOREIGN KEY ("admin_audit_log_id") REFERENCES "public"."admin_audit_logs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger_entries" DROP CONSTRAINT IF EXISTS "credit_ledger_entries_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "credit_ledger_entries" ADD CONSTRAINT "credit_ledger_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger_entries" DROP CONSTRAINT IF EXISTS "credit_ledger_entries_grant_id_credit_grants_id_fk";--> statement-breakpoint
ALTER TABLE "credit_ledger_entries" ADD CONSTRAINT "credit_ledger_entries_grant_id_credit_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."credit_grants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger_entries" DROP CONSTRAINT IF EXISTS "credit_ledger_entries_reservation_id_credit_reservations_id_fk";--> statement-breakpoint
ALTER TABLE "credit_ledger_entries" ADD CONSTRAINT "credit_ledger_entries_reservation_id_credit_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."credit_reservations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger_entries" DROP CONSTRAINT IF EXISTS "credit_ledger_entries_billing_order_id_billing_orders_id_fk";--> statement-breakpoint
ALTER TABLE "credit_ledger_entries" ADD CONSTRAINT "credit_ledger_entries_billing_order_id_billing_orders_id_fk" FOREIGN KEY ("billing_order_id") REFERENCES "public"."billing_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger_entries" DROP CONSTRAINT IF EXISTS "credit_ledger_entries_usage_record_id_usage_records_id_fk";--> statement-breakpoint
ALTER TABLE "credit_ledger_entries" ADD CONSTRAINT "credit_ledger_entries_usage_record_id_usage_records_id_fk" FOREIGN KEY ("usage_record_id") REFERENCES "public"."usage_records"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_reservations" DROP CONSTRAINT IF EXISTS "credit_reservations_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "credit_reservations" ADD CONSTRAINT "credit_reservations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" DROP CONSTRAINT IF EXISTS "payment_transactions_billing_order_id_billing_orders_id_fk";--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_billing_order_id_billing_orders_id_fk" FOREIGN KEY ("billing_order_id") REFERENCES "public"."billing_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_orders" DROP CONSTRAINT IF EXISTS "billing_orders_payment_transaction_id_payment_transactions_id_fk";--> statement-breakpoint
ALTER TABLE "billing_orders" ADD CONSTRAINT "billing_orders_payment_transaction_id_payment_transactions_id_fk" FOREIGN KEY ("payment_transaction_id") REFERENCES "public"."payment_transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_orders" DROP CONSTRAINT IF EXISTS "billing_orders_activated_grant_id_credit_grants_id_fk";--> statement-breakpoint
ALTER TABLE "billing_orders" ADD CONSTRAINT "billing_orders_activated_grant_id_credit_grants_id_fk" FOREIGN KEY ("activated_grant_id") REFERENCES "public"."credit_grants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_records" DROP CONSTRAINT IF EXISTS "usage_records_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_records" DROP CONSTRAINT IF EXISTS "usage_records_reservation_id_credit_reservations_id_fk";--> statement-breakpoint
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_reservation_id_credit_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."credit_reservations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_audit_logs" DROP CONSTRAINT IF EXISTS "admin_audit_logs_billing_order_id_billing_orders_id_fk";--> statement-breakpoint
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_billing_order_id_billing_orders_id_fk" FOREIGN KEY ("billing_order_id") REFERENCES "public"."billing_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_pricing" ADD COLUMN IF NOT EXISTS "price_key" text DEFAULT 'default' NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_audit_logs_admin_created_idx" ON "admin_audit_logs" USING btree ("admin_user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_audit_logs_target_created_idx" ON "admin_audit_logs" USING btree ("target_user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_audit_logs_action_idx" ON "admin_audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "billing_orders_user_created_idx" ON "billing_orders" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "billing_orders_status_idx" ON "billing_orders" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "credit_accounts_user_id_unique" ON "credit_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_accounts_status_idx" ON "credit_accounts" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_grants_user_status_idx" ON "credit_grants" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_grants_user_source_idx" ON "credit_grants" USING btree ("user_id","source");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_grants_expires_at_idx" ON "credit_grants" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_ledger_user_created_idx" ON "credit_ledger_entries" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_ledger_operation_idx" ON "credit_ledger_entries" USING btree ("operation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_ledger_event_type_idx" ON "credit_ledger_entries" USING btree ("event_type");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "credit_reservations_operation_id_unique" ON "credit_reservations" USING btree ("operation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_reservations_user_status_idx" ON "credit_reservations" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_reservations_business_idx" ON "credit_reservations" USING btree ("business_type","business_id");--> statement-breakpoint
DROP INDEX IF EXISTS "model_pricing_provider_model_modality_unique";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "model_pricing_provider_model_modality_price_key_unique" ON "model_pricing" USING btree ("provider","model","modality","price_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "model_pricing_status_idx" ON "model_pricing" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_transactions_order_idx" ON "payment_transactions" USING btree ("billing_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_transactions_provider_tx_unique" ON "payment_transactions" USING btree ("channel","provider_transaction_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usage_records_user_created_idx" ON "usage_records" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usage_records_modality_idx" ON "usage_records" USING btree ("modality");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usage_records_business_idx" ON "usage_records" USING btree ("modality","business_id");
