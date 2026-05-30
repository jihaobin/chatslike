// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const addBillingTablesMigrationPath = resolve(
  currentDir,
  '../../../migrations/0104_add_billing_credits_tables.sql',
);
const creditGrantOperationMigrationPath = resolve(
  currentDir,
  '../../../migrations/0105_add_credit_grants_operation_id.sql',
);

describe('billing migration SQL', () => {
  it('guards credit_grants operation_id not-null migration for partial reruns', async () => {
    const migrationSql = await readFile(creditGrantOperationMigrationPath, 'utf8');

    expect(migrationSql).toContain('DO $$');
    expect(migrationSql).toContain('information_schema.columns');
    expect(migrationSql).toContain(`"is_nullable" = 'YES'`);
    expect(migrationSql).toContain(
      'ALTER TABLE "credit_grants" ALTER COLUMN "operation_id" SET NOT NULL',
    );
  });

  it('keeps billing order audit links protected by foreign keys', async () => {
    const migrationSql = await readFile(addBillingTablesMigrationPath, 'utf8');

    expect(migrationSql).toContain(
      'billing_orders_payment_transaction_id_payment_transactions_id_fk',
    );
    expect(migrationSql).toContain(
      'FOREIGN KEY ("payment_transaction_id") REFERENCES "public"."payment_transactions"("id") ON DELETE set null',
    );
    expect(migrationSql).toContain('billing_orders_activated_grant_id_credit_grants_id_fk');
    expect(migrationSql).toContain(
      'FOREIGN KEY ("activated_grant_id") REFERENCES "public"."credit_grants"("id") ON DELETE set null',
    );
  });
});
