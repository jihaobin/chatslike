import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProviderPricingService } from '../pricingService';

vi.mock('drizzle-orm', async (importOriginal) => {
  const original = await importOriginal<typeof import('drizzle-orm')>();

  return {
    ...original,
    and: vi.fn((...conditions) => conditions),
    desc: vi.fn((field) => ({ desc: field })),
    eq: vi.fn((field, value) => ({ field, value })),
  };
});

const createSelectQuery = (rows: unknown[]) => ({
  from: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockResolvedValue(rows),
  where: vi.fn().mockReturnThis(),
});

const createUpdateQuery = () => {
  const where = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn().mockReturnValue({ where });

  return { set, where };
};

describe('ProviderPricingService', () => {
  const db = {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps pricing isolated by provider instance when model ids match', async () => {
    const relayOnePrice = { id: 'price-1', model: 'gpt-4o', provider: 'newapi-openai-relay' };
    const query = createSelectQuery([relayOnePrice]);
    db.select.mockReturnValueOnce(query);

    await expect(
      new ProviderPricingService(db as never).listModelPricing({
        model: 'gpt-4o',
        provider: 'newapi-openai-relay',
      }),
    ).resolves.toEqual([relayOnePrice]);

    expect(query.where).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ value: 'newapi-openai-relay' })]),
    );
  });

  it('lists future price versions without deciding the current active row', async () => {
    const futurePrice = {
      effectiveAt: new Date('2099-01-01T00:00:00.000Z'),
      id: 'price-future',
      status: 'active',
    };
    const currentPrice = {
      effectiveAt: new Date('2026-01-01T00:00:00.000Z'),
      id: 'price-current',
      status: 'active',
    };
    db.select.mockReturnValueOnce(createSelectQuery([futurePrice, currentPrice]));

    await expect(
      new ProviderPricingService(db as never).listModelPricing({
        model: 'gpt-4o',
        provider: 'newapi-openai-relay',
      }),
    ).resolves.toEqual([futurePrice, currentPrice]);
  });

  it('retires prior active pricing with the same shape before creating a new version', async () => {
    const created = { id: 'price-created', model: 'gpt-4o', provider: 'newapi-openai-relay' };
    const updateQuery = createUpdateQuery();
    const returning = vi.fn().mockResolvedValue([created]);
    const values = vi.fn().mockReturnValue({ returning });
    db.update.mockReturnValueOnce({ set: updateQuery.set });
    db.insert.mockReturnValueOnce({ values });

    await expect(
      new ProviderPricingService(db as never).createModelPricingVersion({
        inputCreditsPerMillionTokens: 10,
        modality: 'text',
        model: 'gpt-4o',
        outputCreditsPerMillionTokens: 20,
        provider: 'newapi-openai-relay',
        reason: 'initial price',
      }),
    ).resolves.toEqual(created);

    expect(updateQuery.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'retired', updatedAt: expect.any(Date) }),
    );
    expect(updateQuery.where).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ value: 'newapi-openai-relay' }),
        expect.objectContaining({ value: 'gpt-4o' }),
        expect.objectContaining({ value: 'text' }),
        expect.objectContaining({ value: 'active' }),
        expect.objectContaining({ value: {} }),
      ]),
    );
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        inputCreditsPerMillionTokens: 10,
        model: 'gpt-4o',
        outputCreditsPerMillionTokens: 20,
        provider: 'newapi-openai-relay',
      }),
    );
  });

  it('retires only the requested price version id', async () => {
    const retired = { id: 'price-1', status: 'retired' };
    const returning = vi.fn().mockResolvedValue([retired]);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    db.update.mockReturnValueOnce({ set });

    await expect(new ProviderPricingService(db as never).retireModelPricingVersion('price-1')).resolves.toEqual(
      retired,
    );

    expect(set).toHaveBeenCalledWith(expect.objectContaining({ status: 'retired' }));
    expect(where).toHaveBeenCalledWith(expect.objectContaining({ value: 'price-1' }));
  });
});
