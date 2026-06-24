CREATE TABLE "admin_operation_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"operator_id" text NOT NULL,
	"target_user_id" text NOT NULL,
	"action" text NOT NULL,
	"before_value" jsonb,
	"after_value" jsonb,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_operation_logs" ADD CONSTRAINT "admin_operation_logs_operator_id_users_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_operation_logs" ADD CONSTRAINT "admin_operation_logs_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_op_logs_operator_idx" ON "admin_operation_logs" USING btree ("operator_id");--> statement-breakpoint
CREATE INDEX "admin_op_logs_target_idx" ON "admin_operation_logs" USING btree ("target_user_id");--> statement-breakpoint
CREATE INDEX "admin_op_logs_action_idx" ON "admin_operation_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "admin_op_logs_created_idx" ON "admin_operation_logs" USING btree ("created_at");--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_billing_order_id_billing_orders_id_fk" FOREIGN KEY ("billing_order_id") REFERENCES "public"."billing_orders"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "billing_orders" ADD CONSTRAINT "billing_orders_payment_transaction_id_payment_transactions_id_fk" FOREIGN KEY ("payment_transaction_id") REFERENCES "public"."payment_transactions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "billing_orders" ADD CONSTRAINT "billing_orders_activated_grant_id_credit_grants_id_fk" FOREIGN KEY ("activated_grant_id") REFERENCES "public"."credit_grants"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "credit_grants" ADD CONSTRAINT "credit_grants_billing_order_id_billing_orders_id_fk" FOREIGN KEY ("billing_order_id") REFERENCES "public"."billing_orders"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "credit_grants" ADD CONSTRAINT "credit_grants_admin_audit_log_id_admin_audit_logs_id_fk" FOREIGN KEY ("admin_audit_log_id") REFERENCES "public"."admin_audit_logs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "credit_ledger_entries" ADD CONSTRAINT "credit_ledger_entries_grant_id_credit_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."credit_grants"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "credit_ledger_entries" ADD CONSTRAINT "credit_ledger_entries_reservation_id_credit_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."credit_reservations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "credit_ledger_entries" ADD CONSTRAINT "credit_ledger_entries_billing_order_id_billing_orders_id_fk" FOREIGN KEY ("billing_order_id") REFERENCES "public"."billing_orders"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "credit_ledger_entries" ADD CONSTRAINT "credit_ledger_entries_usage_record_id_usage_records_id_fk" FOREIGN KEY ("usage_record_id") REFERENCES "public"."usage_records"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_billing_order_id_billing_orders_id_fk" FOREIGN KEY ("billing_order_id") REFERENCES "public"."billing_orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_reservation_id_credit_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."credit_reservations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "model_pricing_provider_model_modality_price_key_unique" ON "model_pricing" USING btree ("provider","model","modality","price_key");

-- Seed: super_admin role + admin permissions
INSERT INTO rbac_roles (id, name, display_name, description, is_system)
VALUES (substr(md5('super_admin'), 1, 16), 'super_admin', 'Super Admin', 'Administrator with all system permissions', true)
ON CONFLICT (name) DO NOTHING;

INSERT INTO rbac_permissions (id, code, name, category)
VALUES
  (substr(md5('admin:dashboard_read:all'), 1, 16), 'admin:dashboard_read:all', 'Admin Dashboard Read', 'admin'),
  (substr(md5('admin:user_read:all'),      1, 16), 'admin:user_read:all',      'Admin User Read',      'admin'),
  (substr(md5('admin:user_write:all'),     1, 16), 'admin:user_write:all',     'Admin User Write',     'admin'),
  (substr(md5('admin:order_read:all'),     1, 16), 'admin:order_read:all',     'Admin Order Read',     'admin'),
  (substr(md5('admin:usage_read:all'),     1, 16), 'admin:usage_read:all',     'Admin Usage Read',     'admin'),
  (substr(md5('admin:audit_read:all'),     1, 16), 'admin:audit_read:all',     'Admin Audit Read',     'admin')
ON CONFLICT (code) DO NOTHING;

INSERT INTO rbac_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM rbac_roles r CROSS JOIN rbac_permissions p
WHERE r.name = 'super_admin' AND p.code LIKE 'admin:%'
ON CONFLICT DO NOTHING;
