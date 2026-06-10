// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { chargeAfterGenerate } from '../../video-generation/chargeAfterGenerate';
import { chargeBeforeGenerate } from '../../video-generation/chargeBeforeGenerate';

const {
  assertPrechargeRisk,
  captureUsageCredits,
  createUsageRecord,
  getVideoPricing,
  mockDb,
  releaseUsageCredits,
  reserveUsageCredits,
} = vi.hoisted(() => {
  const transaction = vi.fn();

  return {
    assertPrechargeRisk: vi.fn(),
    captureUsageCredits: vi.fn(),
    createUsageRecord: vi.fn(),
    getVideoPricing: vi.fn(),
    mockDb: { transaction },
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
  getVideoPricing,
}));

describe('video generation billing', () => {
  beforeEach(() => {
    assertPrechargeRisk.mockReset();
    assertPrechargeRisk.mockResolvedValue(undefined);
    captureUsageCredits.mockReset();
    createUsageRecord.mockReset();
    getVideoPricing.mockReset();
    getVideoPricing.mockResolvedValue({ fixedCreditsPerUnit: 30_000 });
    releaseUsageCredits.mockReset();
    reserveUsageCredits.mockReset();
    mockDb.transaction.mockReset();
    reserveUsageCredits.mockResolvedValue({ id: 'reservation-video-1' });
    captureUsageCredits.mockResolvedValue({
      capturedCredits: 100_000,
      releasedCredits: 0,
      status: 'captured',
    });
    createUsageRecord.mockResolvedValue({ id: 'usage-video-1' });
  });

  it('reserves fixed credits before video generation', async () => {
    const result = await chargeBeforeGenerate({
      generationTopicId: 'topic-1',
      model: 'default-video',
      params: { duration: 5, prompt: 'city' } as never,
      provider: 'lobehub',
      userId: 'user-1',
    });

    expect(reserveUsageCredits).toHaveBeenCalledWith(
      expect.objectContaining({
        businessType: 'video',
        estimatedCredits: 150_000,
        model: 'default-video',
        provider: 'lobehub',
      }),
    );
    expect(assertPrechargeRisk).toHaveBeenCalledWith({
      checkGenerationConcurrency: true,
      db: mockDb,
      estimatedCredits: 150_000,
      userId: 'user-1',
    });
    expect(getVideoPricing).toHaveBeenCalledWith({
      model: 'default-video',
      parameters: expect.objectContaining({
        duration: 5,
        unit: 'second',
      }),
      provider: 'lobehub',
    });
    expect(assertPrechargeRisk.mock.invocationCallOrder[0]).toBeLessThan(
      reserveUsageCredits.mock.invocationCallOrder[0],
    );
    expect(result.prechargeResult).toMatchObject({
      estimatedCredits: 150_000,
      reservationId: 'reservation-video-1',
    });
  });

  it('reserves estimated token credits before video generation when video pricing is token based', async () => {
    getVideoPricing.mockResolvedValue({
      inputCreditsPerMillionTokens: 10_000,
      outputCreditsPerMillionTokens: 20_000,
    });

    const result = await chargeBeforeGenerate({
      generationTopicId: 'topic-1',
      model: 'default-video',
      params: { duration: 5, prompt: 'city' } as never,
      provider: 'lobehub',
      userId: 'user-1',
    });

    expect(reserveUsageCredits).toHaveBeenCalledWith(
      expect.objectContaining({
        businessType: 'video',
        estimatedCredits: 101,
        model: 'default-video',
        provider: 'lobehub',
      }),
    );
    expect(result.prechargeResult).toMatchObject({
      estimatedCredits: 101,
      reservationId: 'reservation-video-1',
    });
  });

  it('returns an error batch before provider submission when precharge fails', async () => {
    reserveUsageCredits.mockRejectedValue({
      availableCredits: 10_000,
      code: 'INSUFFICIENT_CREDITS',
      deficitCredits: 140_000,
      requiredCredits: 150_000,
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
      generationTopicId: 'topic-1',
      model: 'default-video',
      params: { duration: 5, prompt: 'city' } as never,
      provider: 'lobehub',
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
      generationTopicId: 'topic-1',
      model: 'default-video',
      params: { duration: 5, prompt: 'city' } as never,
      provider: 'lobehub',
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

  it('captures fixed credits after video generation succeeds', async () => {
    await chargeAfterGenerate({
      metadata: {
        asyncTaskId: 'task-1',
        generationBatchId: 'batch-1',
        modelId: 'default-video',
        topicId: 'topic-1',
      },
      model: 'default-video',
      prechargeResult: {
        estimatedCredits: 100_000,
        operationId: 'video:user-1:topic-1:lobehub:default-video:hash',
        reservationId: 'reservation-video-1',
      },
      provider: 'lobehub',
      userId: 'user-1',
    });

    expect(captureUsageCredits).toHaveBeenCalledWith({
      actualCredits: 100_000,
      operationId: 'video:user-1:topic-1:lobehub:default-video:hash:capture',
      reservationId: 'reservation-video-1',
      usageRecordId: 'usage-video-1',
    });
    expect(createUsageRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        actualCredits: 100_000,
        businessId: 'batch-1',
        modality: 'video',
        reservationId: 'reservation-video-1',
        status: 'captured',
      }),
    );
  });

  it('captures token-priced video credits when usage is available', async () => {
    getVideoPricing.mockResolvedValue({
      inputCreditsPerMillionTokens: 10_000,
      outputCreditsPerMillionTokens: 20_000,
    });

    await chargeAfterGenerate({
      metadata: {
        asyncTaskId: 'task-1',
        generationBatchId: 'batch-1',
        modelId: 'default-video',
        topicId: 'topic-1',
      },
      model: 'default-video',
      prechargeResult: {
        estimatedCredits: 1,
        operationId: 'video:user-1:topic-1:lobehub:default-video:hash',
        reservationId: 'reservation-video-1',
      },
      provider: 'lobehub',
      usage: { completionTokens: 500_000, totalTokens: 1_500_000 },
      userId: 'user-1',
    });

    expect(captureUsageCredits).toHaveBeenCalledWith({
      actualCredits: 20_000,
      operationId: 'video:user-1:topic-1:lobehub:default-video:hash:capture',
      reservationId: 'reservation-video-1',
      usageRecordId: 'usage-video-1',
    });
    expect(createUsageRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        actualCredits: 20_000,
        estimatedCredits: 1,
        modality: 'video',
        reservationId: 'reservation-video-1',
      }),
    );
  });

  it('releases reserved credits after video generation fails', async () => {
    await chargeAfterGenerate({
      isError: true,
      metadata: {
        asyncTaskId: 'task-1',
        generationBatchId: 'batch-1',
        modelId: 'default-video',
        topicId: 'topic-1',
      },
      model: 'default-video',
      prechargeResult: {
        estimatedCredits: 100_000,
        operationId: 'video:user-1:topic-1:lobehub:default-video:hash',
        reservationId: 'reservation-video-1',
      },
      provider: 'lobehub',
      userId: 'user-1',
    });

    expect(releaseUsageCredits).toHaveBeenCalledWith({
      operationId: 'video:user-1:topic-1:lobehub:default-video:hash:release',
      reason: 'video_generation_failed',
      reservationId: 'reservation-video-1',
    });
  });
});
