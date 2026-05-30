// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  adminAuditLogs,
  billingOrders,
  creditAccounts,
  creditGrants,
  creditLedgerEntries,
  creditReservations,
  modelPricing,
  paymentTransactions,
  usageRecords,
} from '../../schemas';

describe('billing schema exports', () => {
  it('exports all commercial billing tables', () => {
    expect(creditAccounts).toBeDefined();
    expect(creditGrants).toBeDefined();
    expect(creditReservations).toBeDefined();
    expect(creditLedgerEntries).toBeDefined();
    expect(modelPricing).toBeDefined();
    expect(billingOrders).toBeDefined();
    expect(paymentTransactions).toBeDefined();
    expect(usageRecords).toBeDefined();
    expect(adminAuditLogs).toBeDefined();
  });

  it('supports parameterized model pricing rows', () => {
    expect(modelPricing.priceKey).toBeDefined();
  });
});
