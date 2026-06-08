import { describe, expect, it, vi } from 'vitest';

const mutate = vi.hoisted(() => vi.fn());

vi.mock('swr', () => ({
  default: vi.fn(),
  mutate,
}));

describe('useBillingData', () => {
  it('refreshes every cached billing orders page', async () => {
    const { refreshBillingOrders } = await import('./useBillingData');

    refreshBillingOrders();

    const predicate = mutate.mock.calls[0]?.[0];
    expect(predicate).toBeTypeOf('function');
    expect(predicate(['billing.orders', 20, undefined, ['paid', 'activated']])).toBe(true);
    expect(predicate(['billing.orders', 20, 'order-page-1', ['paid', 'activated']])).toBe(true);
    expect(predicate(['billing.usageRecords', 20])).toBe(false);
  });
});
