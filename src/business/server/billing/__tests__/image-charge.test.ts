// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  assertPrechargeRisk,
  captureUsageCredits,
  createUsageRecord,
  getImagePricing,
  mockBatch,
  mockDb,
  releaseUsageCredits,
  reserveUsageCredits,
} = vi.hoisted(() => {
  const transaction = vi.fn();

  return {
    assertPrechargeRisk: vi.fn(),
    captureUsageCredits: vi.fn(),
    createUsageRecord: vi.fn(),
    getImagePricing: vi.fn(),
    mockDb: {
      query: {
        generationBatches: {
          findFirst: vi.fn(),
        },
      },
      transaction,
    },
    mockBatch: {
      config: {
        billing: {
          estimatedCredits: 40_000,
          operationId: 'image:user-1:topic-1:openai:dall-e-3:hash',
          reservationId: 'reservation-image-1',
        },
        prompt: 'cat',
        size: '1024x1024',
      },
      id: 'batch-1',
      model: 'dall-e-3',
      provider: 'openai',
    },
    releaseUsageCredits: vi.fn(),
    reserveUsageCredits: vi.fn(),
  };
});

vi.mock('../credits', () => ({
  CreditsService: vi.fn().mockImplementation(() => ({
    captureUsageCredits,
    createUsageRecord,
    releaseUsageCredits,
    reserveUsageCredits,
  })),
}));

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn().mockResolvedValue(mockDb),
}));

vi.mock('../risk', () => ({
  assertPrechargeRisk,
}));

vi.mock('../pricing', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  getImagePricing,
}));

import { chargeAfterGenerate } from '../../image-generation/chargeAfterGenerate';
import { chargeBeforeGenerate } from '../../image-generation/chargeBeforeGenerate';

describe('image generation billing', () => {
  beforeEach(() => {
    assertPrechargeRisk.mockReset();
    assertPrechargeRisk.mockResolvedValue(undefined);
    captureUsageCredits.mockReset();
    createUsageRecord.mockReset();
    getImagePricing.mockReset();
    getImagePricing.mockResolvedValue({ fixedCreditsPerUnit: 80_000 });
    releaseUsageCredits.mockReset();
    reserveUsageCredits.mockReset();
    mockDb.transaction.mockReset();
    reserveUsageCredits.mockResolvedValue({ id: 'reservation-image-1' });
    mockDb.query.generationBatches.findFirst.mockResolvedValue(mockBatch);
    captureUsageCredits.mockResolvedValue({
      capturedCredits: 40_000,
      releasedCredits: 0,
      status: 'captured',
    });
    createUsageRecord.mockResolvedValue({ id: 'usage-image-1' });
  });

  it('reserves fixed credits before image generation and returns billing batch config', async () => {
    const result = await chargeBeforeGenerate({
      configForDatabase: { prompt: 'cat', size: '1024x1024' } as never,
      generationParams: { prompt: 'cat', size: '1024x1024' } as never,
      generationTopicId: 'topic-1',
      imageNum: 1,
      model: 'dall-e-3',
      provider: 'openai',
      userId: 'user-1',
    });

    expect(reserveUsageCredits).toHaveBeenCalledWith(
      expect.objectContaining({
        businessType: 'image',
        estimatedCredits: 80_000,
        model: 'dall-e-3',
        provider: 'openai',
      }),
    );
    expect(assertPrechargeRisk).toHaveBeenCalledWith({
      checkGenerationConcurrency: true,
      db: mockDb,
      estimatedCredits: 80_000,
      userId: 'user-1',
    });
    expect(getImagePricing).toHaveBeenCalledWith({
      model: 'dall-e-3',
      parameters: expect.objectContaining({
        quality: 'standard',
        size: '1024x1024',
      }),
      provider: 'openai',
    });
    expect(assertPrechargeRisk.mock.invocationCallOrder[0]).toBeLessThan(
      reserveUsageCredits.mock.invocationCallOrder[0],
    );
    expect(result?.billing).toMatchObject({
      estimatedCredits: 80_000,
      reservationId: 'reservation-image-1',
    });
  });

  it('returns an error batch before provider submission when precharge fails', async () => {
    reserveUsageCredits.mockRejectedValue({
      availableCredits: 10_000,
      code: 'INSUFFICIENT_CREDITS',
      deficitCredits: 70_000,
      requiredCredits: 80_000,
    });
    mockDb.transaction.mockImplementation(async (callback) => {
      const batch = { id: 'batch-error' };
      const generation = { id: 'generation-error' };
      const asyncTask = { id: 'async-error' };
      const insertedRows = [batch, generation, asyncTask];
      let insertIndex = 0;

      const insert = vi.fn(() => ({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockImplementation(() => [insertedRows[insertIndex++]]),
        }),
      }));
      const update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ ...generation, asyncTaskId: asyncTask.id }]),
          where: vi.fn().mockReturnThis(),
        }),
      });

      return callback({ insert, update });
    });

    const result = await chargeBeforeGenerate({
      configForDatabase: { prompt: 'cat', size: '1024x1024' } as never,
      generationParams: { prompt: 'cat', size: '1024x1024' } as never,
      generationTopicId: 'topic-1',
      imageNum: 1,
      model: 'dall-e-3',
      provider: 'openai',
      userId: 'user-1',
    });

    expect(result.errorBatch).toMatchObject({
      data: {
        batch: { id: 'batch-error' },
        generations: [{ asyncTaskId: 'async-error', id: 'generation-error' }],
      },
      success: true,
    });
  });

  it('returns an error batch before provider submission when phone verification is required', async () => {
    assertPrechargeRisk.mockRejectedValue({
      code: 'PHONE_VERIFICATION_REQUIRED',
      errorType: 'PHONE_VERIFICATION_REQUIRED',
    });
    mockDb.transaction.mockImplementation(async (callback) => {
      const batch = { id: 'batch-phone-required' };
      const generation = { id: 'generation-phone-required' };
      const asyncTask = { id: 'async-phone-required' };
      const insertedRows = [batch, generation, asyncTask];
      let insertIndex = 0;

      const insert = vi.fn(() => ({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockImplementation(() => [insertedRows[insertIndex++]]),
        }),
      }));
      const update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ ...generation, asyncTaskId: asyncTask.id }]),
          where: vi.fn().mockReturnThis(),
        }),
      });

      return callback({ insert, update });
    });

    const result = await chargeBeforeGenerate({
      configForDatabase: { prompt: 'cat', size: '1024x1024' } as never,
      generationParams: { prompt: 'cat', size: '1024x1024' } as never,
      generationTopicId: 'topic-1',
      imageNum: 1,
      model: 'dall-e-3',
      provider: 'openai',
      userId: 'user-1',
    });

    expect(reserveUsageCredits).not.toHaveBeenCalled();
    expect(result.errorBatch).toMatchObject({
      data: {
        batch: { id: 'batch-phone-required' },
        generations: [{ asyncTaskId: 'async-phone-required', id: 'generation-phone-required' }],
      },
      success: true,
    });
  });

  it('captures fixed credits after image generation succeeds', async () => {
    await chargeAfterGenerate({
      metadata: {
        asyncTaskId: 'task-1',
        generationBatchId: 'batch-1',
        modelId: 'dall-e-3',
        topicId: 'topic-1',
      },
      provider: 'openai',
      success: true,
      userId: 'user-1',
    });

    expect(captureUsageCredits).toHaveBeenCalledWith({
      actualCredits: 40_000,
      operationId: 'image:user-1:topic-1:openai:dall-e-3:hash:capture',
      reservationId: 'reservation-image-1',
      usageRecordId: 'usage-image-1',
    });
    expect(createUsageRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        actualCredits: 40_000,
        businessId: 'batch-1',
        modality: 'image',
        reservationId: 'reservation-image-1',
        status: 'captured',
      }),
    );
  });

  it('releases reserved credits after image generation fails', async () => {
    await chargeAfterGenerate({
      metadata: {
        asyncTaskId: 'task-1',
        generationBatchId: 'batch-1',
        modelId: 'dall-e-3',
        topicId: 'topic-1',
      },
      provider: 'openai',
      success: false,
      userId: 'user-1',
    });

    expect(releaseUsageCredits).toHaveBeenCalledWith({
      operationId: 'image:user-1:topic-1:openai:dall-e-3:hash:release',
      reason: 'image_generation_failed',
      reservationId: 'reservation-image-1',
    });
  });
});
