import { describe, expect, it, vi } from 'vitest';

import { AsyncTaskModel } from '@/database/models/asyncTask';
import { initModelRuntimeFromDB } from '@/server/modules/ModelRuntime';
import {
  markVideoGenerationFailed,
  processCompletedVideoGeneration,
} from '@/server/services/generation/videoBackgroundPolling';
import { AsyncTaskStatus, AsyncTaskType } from '@/types/asyncTask';

import { syncVideoGenerationTaskStatus } from './videoTaskStatusSync';

vi.mock('@/database/models/asyncTask');
vi.mock('@/server/modules/ModelRuntime', () => ({
  initModelRuntimeFromDB: vi.fn(),
}));
vi.mock('@/server/services/generation/videoBackgroundPolling', () => ({
  markVideoGenerationFailed: vi.fn(),
  processCompletedVideoGeneration: vi.fn(),
}));

describe('syncVideoGenerationTaskStatus', () => {
  const asyncTask = {
    createdAt: new Date('2024-01-01T00:00:00Z'),
    id: 'task-1',
    inferenceId: 'upstream-task-1',
    metadata: { precharge: { reservationId: 'reservation-1' } },
    status: AsyncTaskStatus.Processing,
    type: AsyncTaskType.VideoGeneration,
  } as any;

  const generation = {
    generationBatchId: 'batch-1',
    id: 'gen-1',
  };
  const batch = {
    generationTopicId: 'topic-1',
    model: 'doubao-seedance-2.0',
    provider: 'newapi',
  };

  const db = {
    query: {
      generationBatches: {
        findFirst: vi.fn(),
      },
      generations: {
        findFirst: vi.fn(),
      },
    },
    update: vi.fn(),
  } as any;

  const runtime = {
    handlePollVideoStatus: vi.fn(),
  };

  const asyncTaskModel = {
    findById: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    db.query.generations.findFirst.mockResolvedValue(generation);
    db.query.generationBatches.findFirst.mockResolvedValue(batch);
    db.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'task-1' }]),
        }),
      }),
    });
    vi.mocked(initModelRuntimeFromDB).mockResolvedValue(runtime as any);
    vi.mocked(AsyncTaskModel).mockImplementation(() => asyncTaskModel as any);
  });

  it('should ignore non-video tasks', async () => {
    const task = { ...asyncTask, type: AsyncTaskType.ImageGeneration };

    const result = await syncVideoGenerationTaskStatus({
      asyncTask: task,
      db,
      generationId: 'gen-1',
      userId: 'user-1',
    });

    expect(result).toBe(task);
    expect(initModelRuntimeFromDB).not.toHaveBeenCalled();
  });

  it('should keep processing task unchanged when upstream is pending', async () => {
    runtime.handlePollVideoStatus.mockResolvedValue({ status: 'pending' });

    const result = await syncVideoGenerationTaskStatus({
      asyncTask,
      db,
      generationId: 'gen-1',
      userId: 'user-1',
    });

    expect(result).toBe(asyncTask);
    expect(processCompletedVideoGeneration).not.toHaveBeenCalled();
    expect(markVideoGenerationFailed).not.toHaveBeenCalled();
  });

  it('should process completed upstream video and return refreshed task', async () => {
    const updatedTask = { ...asyncTask, status: AsyncTaskStatus.Success };
    runtime.handlePollVideoStatus.mockResolvedValue({
      headers: { Authorization: 'Bearer token' },
      status: 'success',
      videoUrl: 'https://cdn.amux.ai/video.mp4',
    });
    asyncTaskModel.findById.mockResolvedValue(updatedTask);

    const result = await syncVideoGenerationTaskStatus({
      asyncTask,
      db,
      generationId: 'gen-1',
      userId: 'user-1',
    });

    expect(processCompletedVideoGeneration).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        asyncTaskId: 'task-1',
        generationBatchId: 'batch-1',
        generationId: 'gen-1',
        generationTopicId: 'topic-1',
        inferenceId: 'upstream-task-1',
        model: 'doubao-seedance-2.0',
        prechargeResult: { reservationId: 'reservation-1' },
        provider: 'newapi',
        userId: 'user-1',
      }),
      {
        headers: { Authorization: 'Bearer token' },
        status: 'success',
        videoUrl: 'https://cdn.amux.ai/video.mp4',
      },
    );
    expect(result).toBe(updatedTask);
  });

  it('should skip completed upstream video when another request is already syncing it', async () => {
    runtime.handlePollVideoStatus.mockResolvedValue({
      status: 'success',
      videoUrl: 'https://cdn.amux.ai/video.mp4',
    });
    db.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const result = await syncVideoGenerationTaskStatus({
      asyncTask,
      db,
      generationId: 'gen-1',
      userId: 'user-1',
    });

    expect(processCompletedVideoGeneration).not.toHaveBeenCalled();
    expect(result).toBe(asyncTask);
  });
});
