import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GLOBAL_PROVIDER_SCOPE_FORBIDDEN } from '@/business/server/globalProviderScope/permissions';
import { getServerDB } from '@/database/core/db-adaptor';

import { providerPricingRouter } from '../providerPricing';

vi.mock('@/database/core/db-adaptor');

describe('providerPricingRouter', () => {
  const mockUserId = 'test-user-id';
  const mockPricingRow = {
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    currency: 'CNY',
    effectiveAt: new Date('2026-01-01T00:00:00.000Z'),
    id: 'price-1',
    inputCreditsPerMillionTokens: 10,
    model: 'gpt-4o',
    outputCreditsPerMillionTokens: 20,
    provider: 'openai',
    status: 'active',
  };
  const mockDb = {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
  };

  const mockRoleLookup = (role?: string) => {
    const query = {
      from: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(role ? [{ role }] : []),
      where: vi.fn().mockReturnThis(),
    };
    return query;
  };

  const mockSentinelUserInsert = () => {
    const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn().mockReturnValue({ onConflictDoNothing });
    return { onConflictDoNothing, query: { values }, values };
  };

  const mockUpdateQuery = () => {
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where });

    return { query: { set }, set, where };
  };

  const mockPricingListQuery = (rows = [mockPricingRow]) => {
    const query = {
      from: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue(rows),
      where: vi.fn().mockReturnThis(),
    };
    return query;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerDB).mockResolvedValue(mockDb as never);
    mockDb.select.mockReturnValue(mockRoleLookup('user'));
  });

  it('rejects ordinary user explicit global pricing reads', async () => {
    const caller = providerPricingRouter.createCaller({ userId: mockUserId });

    await expect(
      caller.listModelPricing({ model: 'gpt-4o', provider: 'openai', scope: 'global' }),
    ).rejects.toMatchObject({ message: GLOBAL_PROVIDER_SCOPE_FORBIDDEN });
  });

  it('lets super-admin list global model pricing rows', async () => {
    const roleQuery = mockRoleLookup('super-admin');
    const query = mockPricingListQuery();
    mockDb.select.mockReturnValueOnce(roleQuery).mockReturnValueOnce(query);
    const caller = providerPricingRouter.createCaller({ userId: mockUserId });

    await expect(
      caller.listModelPricing({ model: 'gpt-4o', provider: 'openai', scope: 'global' }),
    ).resolves.toEqual({ data: [mockPricingRow], success: true });
    expect(query.where).toHaveBeenCalled();
    expect(query.orderBy).toHaveBeenCalled();
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('filters ordinary pricing reads to current active rows effective now', async () => {
    const currentRow = {
      ...mockPricingRow,
      effectiveAt: new Date('2025-01-01T00:00:00.000Z'),
      id: 'price-current',
      parameterRules: {},
    };
    const historicalActiveRow = {
      ...mockPricingRow,
      effectiveAt: new Date('2024-01-01T00:00:00.000Z'),
      id: 'price-historical-active',
      parameterRules: {},
    };
    const variantCurrentRow = {
      ...mockPricingRow,
      effectiveAt: new Date('2025-03-01T00:00:00.000Z'),
      id: 'price-variant-current',
      parameterRules: { size: '1024x1024' },
    };
    const futureRow = {
      ...mockPricingRow,
      effectiveAt: new Date('2099-01-01T00:00:00.000Z'),
      id: 'price-future',
    };
    const retiredRow = {
      ...mockPricingRow,
      effectiveAt: new Date('2025-02-01T00:00:00.000Z'),
      id: 'price-retired',
      status: 'retired',
    };
    const query = mockPricingListQuery([
      futureRow,
      variantCurrentRow,
      retiredRow,
      currentRow,
      historicalActiveRow,
    ]);
    mockDb.select.mockReturnValueOnce(query);
    const caller = providerPricingRouter.createCaller({ userId: mockUserId });

    await expect(
      caller.listModelPricing({ model: 'gpt-4o', provider: 'openai', scope: 'user' }),
    ).resolves.toEqual({ data: [variantCurrentRow, currentRow], success: true });

    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('rejects pricing version creation without a price dimension', async () => {
    mockDb.select.mockReturnValue(mockRoleLookup('super-admin'));
    const caller = providerPricingRouter.createCaller({ userId: mockUserId });

    await expect(
      caller.createModelPricingVersion({
        model: 'gpt-4o',
        provider: 'openai',
        reason: 'initial price',
        scope: 'global',
      }),
    ).rejects.toThrow();
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('rejects pricing version creation with only zero-valued prices', async () => {
    mockDb.select.mockReturnValue(mockRoleLookup('super-admin'));
    const caller = providerPricingRouter.createCaller({ userId: mockUserId });

    await expect(
      caller.createModelPricingVersion({
        fixedCreditsPerUnit: 0,
        inputCreditsPerMillionTokens: 0,
        model: 'gpt-4o',
        outputCreditsPerMillionTokens: 0,
        provider: 'openai',
        reason: 'initial price',
        scope: 'global',
      }),
    ).rejects.toThrow();
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('rejects fractional credit values when creating pricing versions', async () => {
    mockDb.select.mockReturnValue(mockRoleLookup('super-admin'));
    const caller = providerPricingRouter.createCaller({ userId: mockUserId });

    await expect(
      caller.createModelPricingVersion({
        inputCreditsPerMillionTokens: 10.5,
        model: 'gpt-4o',
        provider: 'openai',
        reason: 'initial price',
        scope: 'global',
      }),
    ).rejects.toThrow();
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('creates pricing versions with response envelope for super-admins', async () => {
    const roleQuery = mockRoleLookup('super-admin');
    const sentinelInsert = mockSentinelUserInsert();
    const updateQuery = mockUpdateQuery();
    const returning = vi.fn().mockResolvedValue([mockPricingRow]);
    const insertQuery = {
      returning,
      values: vi.fn().mockReturnValue({ returning }),
    };
    mockDb.select.mockReturnValueOnce(roleQuery);
    mockDb.insert.mockReturnValueOnce(sentinelInsert.query).mockReturnValueOnce(insertQuery);
    mockDb.update.mockReturnValueOnce(updateQuery.query);
    const caller = providerPricingRouter.createCaller({ userId: mockUserId });

    await expect(
      caller.createModelPricingVersion({
        inputCreditsPerMillionTokens: 10,
        model: 'gpt-4o',
        provider: 'openai',
        reason: 'initial price',
        scope: 'global',
      }),
    ).resolves.toEqual({
      data: mockPricingRow,
      message: 'Model pricing version created',
      success: true,
    });
    expect(sentinelInsert.onConflictDoNothing).toHaveBeenCalled();
    expect(updateQuery.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'retired', updatedAt: expect.any(Date) }),
    );
    expect(updateQuery.where).toHaveBeenCalled();
    expect(insertQuery.values).toHaveBeenCalledWith(
      expect.objectContaining({
        currency: 'CNY',
        inputCreditsPerMillionTokens: 10,
        modality: 'text',
        status: 'active',
        unit: 'unit',
      }),
    );
  });

  it('requires global scope when creating pricing versions', async () => {
    const caller = providerPricingRouter.createCaller({ userId: mockUserId });

    await expect(
      caller.createModelPricingVersion({
        inputCreditsPerMillionTokens: 10,
        model: 'gpt-4o',
        outputCreditsPerMillionTokens: 20,
        provider: 'openai',
        reason: 'initial price',
        scope: 'user',
      }),
    ).rejects.toMatchObject({ message: 'GLOBAL_PROVIDER_SCOPE_REQUIRED' });
  });
});
