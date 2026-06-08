import { beforeEach, describe, expect, it, vi } from 'vitest';

import { lambdaClient } from '@/libs/trpc/client';
import { billingService } from '@/services/billing';

vi.mock('@/libs/trpc/client', () => ({
  lambdaClient: {
    topUp: {
      listOrders: { query: vi.fn() },
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('BillingService', () => {
  it('lists user-facing orders with cursor and status filters', async () => {
    const statuses = ['paid', 'activated'] as const;

    await billingService.listOrders({
      cursor: 'order-page-1',
      pageSize: 20,
      statuses,
    });

    expect(lambdaClient.topUp.listOrders.query).toHaveBeenCalledWith({
      cursor: 'order-page-1',
      pageSize: 20,
      statuses: ['paid', 'activated'],
    });
  });
});
