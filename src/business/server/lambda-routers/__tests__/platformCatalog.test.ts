// @vitest-environment node
import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { platformCatalogRouter } from '../platformCatalog';

const {
  createModelPricingVersion,
  getNewApiProviderStatus,
  listModelPricing,
  listPlatformModels,
  mockDb,
  retireModelPricingVersion,
  togglePlatformModelEnabled,
  updateNewApiProviderStatus,
  updatePlatformModel,
} = vi.hoisted(() => ({
  createModelPricingVersion: vi.fn(),
  getNewApiProviderStatus: vi.fn(),
  listModelPricing: vi.fn(),
  listPlatformModels: vi.fn(),
  mockDb: {
    query: {
      users: {
        findFirst: vi.fn(),
      },
    },
  },
  retireModelPricingVersion: vi.fn(),
  togglePlatformModelEnabled: vi.fn(),
  updateNewApiProviderStatus: vi.fn(),
  updatePlatformModel: vi.fn(),
}));

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn(async () => mockDb),
}));

vi.mock('@/business/server/platformCatalog/service', () => ({
  PlatformCatalogService: vi.fn().mockImplementation(() => ({
    createModelPricingVersion,
    getNewApiProviderStatus,
    listModelPricing,
    listPlatformModels,
    retireModelPricingVersion,
    togglePlatformModelEnabled,
    updateNewApiProviderStatus,
    updatePlatformModel,
  })),
}));

describe('platformCatalogRouter', () => {
  beforeEach(() => {
    mockDb.query.users.findFirst.mockReset();
    createModelPricingVersion.mockReset();
    getNewApiProviderStatus.mockReset();
    listModelPricing.mockReset();
    listPlatformModels.mockReset();
    retireModelPricingVersion.mockReset();
    togglePlatformModelEnabled.mockReset();
    updateNewApiProviderStatus.mockReset();
    updatePlatformModel.mockReset();
  });

  it('rejects non super-admin callers', async () => {
    mockDb.query.users.findFirst.mockResolvedValue({ id: 'normal-user', role: null });
    const caller = platformCatalogRouter.createCaller({ userId: 'normal-user' });

    try {
      await caller.getNewApiProviderStatus();
      throw new Error('Expected platformCatalogRouter to reject non-admin caller');
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      expect((error as TRPCError).code).toBe('FORBIDDEN');
    }
    expect(getNewApiProviderStatus).not.toHaveBeenCalled();
  });

  it('allows super-admin to read New API provider status', async () => {
    mockDb.query.users.findFirst.mockResolvedValue({ id: 'super-admin-user', role: 'super-admin' });
    getNewApiProviderStatus.mockResolvedValue({ provider: 'newapi' });
    const caller = platformCatalogRouter.createCaller({ userId: 'super-admin-user' });

    await expect(caller.getNewApiProviderStatus()).resolves.toEqual({ provider: 'newapi' });
    expect(getNewApiProviderStatus).toHaveBeenCalled();
  });

  it('validates update model input and forwards editable fields', async () => {
    mockDb.query.users.findFirst.mockResolvedValue({ id: 'super-admin-user', role: 'super-admin' });
    updatePlatformModel.mockResolvedValue({ id: 'gpt-4.1' });
    const caller = platformCatalogRouter.createCaller({ userId: 'super-admin-user' });

    await expect(
      caller.updatePlatformModel({
        displayName: 'GPT 4.1',
        model: 'gpt-4.1',
        reason: 'rename',
        upstreamDisplayName: 'OpenAI',
        upstreamProvider: 'openai',
      }),
    ).resolves.toEqual({ id: 'gpt-4.1' });
    expect(updatePlatformModel).toHaveBeenCalledWith({
      displayName: 'GPT 4.1',
      model: 'gpt-4.1',
      reason: 'rename',
      upstreamDisplayName: 'OpenAI',
      upstreamProvider: 'openai',
    });

    await expect(
      caller.updatePlatformModel({ displayName: 'Missing reason', model: 'gpt-4.1', reason: '' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('validates create pricing input and forwards New API pricing version params', async () => {
    mockDb.query.users.findFirst.mockResolvedValue({ id: 'super-admin-user', role: 'super-admin' });
    createModelPricingVersion.mockResolvedValue({ id: 'pricing-1' });
    const caller = platformCatalogRouter.createCaller({ userId: 'super-admin-user' });
    const effectiveAt = new Date('2026-06-03T00:00:00.000Z');

    await expect(
      caller.createModelPricingVersion({
        effectiveAt,
        inputCreditsPerMillionTokens: 1000,
        modality: 'text',
        model: 'gpt-4.1',
        outputCreditsPerMillionTokens: 2000,
        priceKey: 'scheduled',
        reason: 'new version',
      }),
    ).resolves.toEqual({ id: 'pricing-1' });
    expect(createModelPricingVersion).toHaveBeenCalledWith({
      effectiveAt,
      inputCreditsPerMillionTokens: 1000,
      modality: 'text',
      model: 'gpt-4.1',
      outputCreditsPerMillionTokens: 2000,
      priceKey: 'scheduled',
      reason: 'new version',
    });

    await expect(
      caller.createModelPricingVersion({
        modality: 'text',
        model: '',
        reason: 'missing model',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('routes model toggles and pricing retirement to PlatformCatalogService', async () => {
    mockDb.query.users.findFirst.mockResolvedValue({ id: 'super-admin-user', role: 'super-admin' });
    togglePlatformModelEnabled.mockResolvedValue({ enabled: false, id: 'gpt-4.1' });
    retireModelPricingVersion.mockResolvedValue({ id: 'pricing-1', status: 'retired' });
    const caller = platformCatalogRouter.createCaller({ userId: 'super-admin-user' });

    await caller.togglePlatformModelEnabled({
      enabled: false,
      model: 'gpt-4.1',
      reason: 'incident',
    });
    await caller.retireModelPricingVersion({ id: 'pricing-1', reason: 'bad rate' });

    expect(togglePlatformModelEnabled).toHaveBeenCalledWith({
      enabled: false,
      model: 'gpt-4.1',
      reason: 'incident',
    });
    expect(retireModelPricingVersion).toHaveBeenCalledWith({
      id: 'pricing-1',
      reason: 'bad rate',
    });
  });
});
