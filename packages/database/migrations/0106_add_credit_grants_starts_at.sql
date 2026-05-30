ALTER TABLE "credit_grants" ADD COLUMN IF NOT EXISTS "starts_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_grants_starts_at_idx" ON "credit_grants" USING btree ("starts_at");
