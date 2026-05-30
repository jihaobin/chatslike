ALTER TABLE "credit_grants" ADD COLUMN IF NOT EXISTS "operation_id" text;--> statement-breakpoint
UPDATE "credit_grants"
SET "operation_id" = 'legacy:grant:' || "id"
WHERE "operation_id" IS NULL;--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = current_schema()
			AND table_name = 'credit_grants'
			AND column_name = 'operation_id'
			AND "is_nullable" = 'YES'
	) THEN
		IF EXISTS (
			SELECT 1
			FROM "credit_grants"
			WHERE "operation_id" IS NULL
		) THEN
			RAISE EXCEPTION 'credit_grants.operation_id still contains NULL values after deterministic backfill';
		END IF;

		ALTER TABLE "credit_grants" ALTER COLUMN "operation_id" SET NOT NULL;
	END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "credit_grants_operation_id_unique" ON "credit_grants" USING btree ("operation_id");
