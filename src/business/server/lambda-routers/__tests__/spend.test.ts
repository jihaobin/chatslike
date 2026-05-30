// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { spendRouter } from '../spend';

const { getBalance, getTextPricing, listUsageRecords, mockDb } = vi.hoisted(() => ({
  getBalance: vi.fn(),
  getTextPricing: vi.fn(),
  listUsageRecords: vi.fn(),
  mockDb: {},
}));

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn(async () => mockDb),
}));

vi.mock('@/business/server/billing/credits', () => ({
  CreditsService: vi.fn().mockImplementation(() => ({
    getBalance,
    listUsageRecords,
  })),
}));

vi.mock('@/business/server/billing/pricing', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  getTextPricing,
}));

describe('spendRouter', () => {
  beforeEach(() => {
    getBalance.mockReset();
    getTextPricing.mockReset();
    getTextPricing.mockResolvedValue({
      inputCreditsPerMillionTokens: 4_000_000,
      outputCreditsPerMillionTokens: 10_000_000,
    });
    listUsageRecords.mockReset();
  });

  it('returns current credit balance for the authed user', async () => {
    getBalance.mockResolvedValue({
      availableCredits: 500_000,
      frozenCredits: 0,
      lifetimeConsumedCredits: 0,
      lifetimeGrantedCredits: 500_000,
      status: 'active',
    });
    const caller = spendRouter.createCaller({ userId: 'user-1' });

    await expect(caller.getBalance()).resolves.toMatchObject({
      availableCredits: 500_000,
      frozenCredits: 0,
      status: 'active',
    });
  });

  it('estimates text credits with configured hosted model pricing', async () => {
    const caller = spendRouter.createCaller({ userId: 'user-1' });

    await expect(
      caller.estimateText({
        inputTokens: 1000,
        maxOutputTokens: 500,
        model: 'gpt-4.1',
        provider: 'openai',
      }),
    ).resolves.toEqual({ estimatedCredits: 9000 });
    expect(getTextPricing).toHaveBeenCalledWith({ model: 'gpt-4.1', provider: 'openai' });
  });

  it('lists usage records for the authed user', async () => {
    listUsageRecords.mockResolvedValue({
      items: [{ id: 'usage-1', modality: 'text', status: 'captured' }],
      nextCursor: undefined,
    });
    const caller = spendRouter.createCaller({ userId: 'user-1' });

    await expect(caller.listUsageRecords({ pageSize: 20 })).resolves.toMatchObject({
      items: [{ id: 'usage-1', modality: 'text' }],
    });
    expect(listUsageRecords).toHaveBeenCalledWith({ cursor: undefined, pageSize: 20 });
  });
});
