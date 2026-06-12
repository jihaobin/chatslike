import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AsyncTaskModel } from '@/database/models/asyncTask';
import { GenerationModel } from '@/database/models/generation';
import type { AsyncTaskSelectItem } from '@/database/schemas';
import { FileService } from '@/server/services/file';
import { syncVideoGenerationTaskStatus } from '@/server/services/generation/videoTaskStatusSync';
import { AsyncTaskStatus, AsyncTaskType } from '@/types/asyncTask';

import { generationRouter } from '../generation';

vi.mock('@/database/models/asyncTask');
vi.mock('@/database/models/generation');
vi.mock('@/server/services/file');
vi.mock('@/server/services/generation/videoTaskStatusSync', () => ({
  syncVideoGenerationTaskStatus: vi.fn(),
}));

describe('generationRouter', () => {
  type RetryAsyncTaskModelMock = Pick<InstanceType<typeof AsyncTaskModel>, 'findById' | 'update'>;
  type RetryGenerationModelMock = Pick<
    InstanceType<typeof GenerationModel>,
    'findById' | 'findByIdAndTransform'
  >;

  const mockCtx = {
    serverDB: undefined,
    userId: 'test-user',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getGenerationStatus', () => {
    it('should return generation status when task is successful', async () => {
      const mockGeneration = {
        id: 'gen-1',
        asset: { url: 'https://example.com/image.jpg' },
      };
      const mockAsyncTask = {
        id: 'task-1',
        status: AsyncTaskStatus.Success,
        error: null,
      };
      const mockCheckTimeoutTasks = vi.fn().mockResolvedValue(undefined);
      const mockFindById = vi.fn().mockResolvedValue(mockAsyncTask);
      const mockFindByIdAndTransform = vi.fn().mockResolvedValue(mockGeneration);

      vi.mocked(AsyncTaskModel).mockImplementation(
        () =>
          ({
            checkTimeoutTasks: mockCheckTimeoutTasks,
            findById: mockFindById,
          }) as any,
      );
      vi.mocked(GenerationModel).mockImplementation(
        () =>
          ({
            findByIdAndTransform: mockFindByIdAndTransform,
          }) as any,
      );

      const caller = generationRouter.createCaller(mockCtx);

      const result = await caller.getGenerationStatus({
        generationId: 'gen-1',
        asyncTaskId: 'task-1',
      });

      expect(result.status).toBe(AsyncTaskStatus.Success);
      expect(result.generation).toEqual(mockGeneration);
      expect(result.error).toBeNull();
      expect(mockCheckTimeoutTasks).toHaveBeenCalledWith(['task-1']);
      expect(mockFindById).toHaveBeenCalledWith('task-1');
      expect(mockFindByIdAndTransform).toHaveBeenCalledWith('gen-1');
    });

    it('should return error and generation when task failed', async () => {
      const mockError = { code: 'GENERATION_ERROR', message: 'Generation failed' };
      const mockGeneration = {
        id: 'gen-1',
        task: {
          error: mockError,
          id: 'task-1',
          status: AsyncTaskStatus.Error,
        },
      };
      const mockAsyncTask = {
        id: 'task-1',
        status: AsyncTaskStatus.Error,
        error: mockError,
      };
      const mockCheckTimeoutTasks = vi.fn().mockResolvedValue(undefined);
      const mockFindById = vi.fn().mockResolvedValue(mockAsyncTask);
      const mockFindByIdAndTransform = vi.fn().mockResolvedValue(mockGeneration);

      vi.mocked(AsyncTaskModel).mockImplementation(
        () =>
          ({
            checkTimeoutTasks: mockCheckTimeoutTasks,
            findById: mockFindById,
          }) as any,
      );
      vi.mocked(GenerationModel).mockImplementation(
        () =>
          ({
            findByIdAndTransform: mockFindByIdAndTransform,
          }) as any,
      );

      const caller = generationRouter.createCaller(mockCtx);

      const result = await caller.getGenerationStatus({
        generationId: 'gen-1',
        asyncTaskId: 'task-1',
      });

      expect(result.status).toBe(AsyncTaskStatus.Error);
      expect(result.generation).toEqual(mockGeneration);
      expect(result.error).toEqual(mockError);
      expect(mockFindByIdAndTransform).toHaveBeenCalledWith('gen-1');
    });

    it('should return pending status when task is running', async () => {
      const mockAsyncTask = {
        id: 'task-1',
        status: AsyncTaskStatus.Pending,
        error: null,
      };
      const mockCheckTimeoutTasks = vi.fn().mockResolvedValue(undefined);
      const mockFindById = vi.fn().mockResolvedValue(mockAsyncTask);

      vi.mocked(AsyncTaskModel).mockImplementation(
        () =>
          ({
            checkTimeoutTasks: mockCheckTimeoutTasks,
            findById: mockFindById,
          }) as any,
      );

      const caller = generationRouter.createCaller(mockCtx);

      const result = await caller.getGenerationStatus({
        generationId: 'gen-1',
        asyncTaskId: 'task-1',
      });

      expect(result.status).toBe(AsyncTaskStatus.Pending);
      expect(result.generation).toBeNull();
      expect(result.error).toBeNull();
    });

    it('should sync completed video task before returning status', async () => {
      const mockGeneration = {
        id: 'gen-1',
        asset: { url: 'https://example.com/video.mp4' },
      };
      const mockAsyncTask = {
        id: 'task-1',
        status: AsyncTaskStatus.Processing,
        error: null,
        inferenceId: 'upstream-task-1',
        type: AsyncTaskType.VideoGeneration,
      };
      const mockSyncedTask = {
        ...mockAsyncTask,
        status: AsyncTaskStatus.Success,
      };
      const mockCheckTimeoutTasks = vi.fn().mockResolvedValue(undefined);
      const mockFindById = vi.fn().mockResolvedValue(mockAsyncTask);
      const mockFindByIdAndTransform = vi.fn().mockResolvedValue(mockGeneration);

      vi.mocked(AsyncTaskModel).mockImplementation(
        () =>
          ({
            checkTimeoutTasks: mockCheckTimeoutTasks,
            findById: mockFindById,
          }) as any,
      );
      vi.mocked(GenerationModel).mockImplementation(
        () =>
          ({
            findByIdAndTransform: mockFindByIdAndTransform,
          }) as any,
      );
      vi.mocked(syncVideoGenerationTaskStatus).mockResolvedValue(mockSyncedTask as any);

      const caller = generationRouter.createCaller(mockCtx);

      const result = await caller.getGenerationStatus({
        generationId: 'gen-1',
        asyncTaskId: 'task-1',
      });

      expect(syncVideoGenerationTaskStatus).toHaveBeenCalledWith({
        asyncTask: mockAsyncTask,
        db: expect.any(Object),
        generationId: 'gen-1',
        userId: 'test-user',
      });
      expect(result.status).toBe(AsyncTaskStatus.Success);
      expect(result.generation).toEqual(mockGeneration);
      expect(mockFindByIdAndTransform).toHaveBeenCalledWith('gen-1');
    });

    it('should keep video task processing when upstream is not completed', async () => {
      const mockAsyncTask = {
        id: 'task-1',
        status: AsyncTaskStatus.Processing,
        error: null,
        inferenceId: 'upstream-task-1',
        type: AsyncTaskType.VideoGeneration,
      };
      const mockCheckTimeoutTasks = vi.fn().mockResolvedValue(undefined);
      const mockFindById = vi.fn().mockResolvedValue(mockAsyncTask);

      vi.mocked(AsyncTaskModel).mockImplementation(
        () =>
          ({
            checkTimeoutTasks: mockCheckTimeoutTasks,
            findById: mockFindById,
          }) as any,
      );
      vi.mocked(syncVideoGenerationTaskStatus).mockResolvedValue(mockAsyncTask as any);

      const caller = generationRouter.createCaller(mockCtx);

      const result = await caller.getGenerationStatus({
        generationId: 'gen-1',
        asyncTaskId: 'task-1',
      });

      expect(result.status).toBe(AsyncTaskStatus.Processing);
      expect(result.generation).toBeNull();
      expect(result.error).toBeNull();
    });

    it('should throw error when async task not found', async () => {
      const mockCheckTimeoutTasks = vi.fn().mockResolvedValue(undefined);
      const mockFindById = vi.fn().mockResolvedValue(null);

      vi.mocked(AsyncTaskModel).mockImplementation(
        () =>
          ({
            checkTimeoutTasks: mockCheckTimeoutTasks,
            findById: mockFindById,
          }) as any,
      );

      const caller = generationRouter.createCaller(mockCtx);

      await expect(
        caller.getGenerationStatus({
          generationId: 'gen-1',
          asyncTaskId: 'task-1',
        }),
      ).rejects.toThrow(TRPCError);
    });

    it('should throw error when generation not found for successful task', async () => {
      const mockAsyncTask = {
        id: 'task-1',
        status: AsyncTaskStatus.Success,
        error: null,
      };
      const mockCheckTimeoutTasks = vi.fn().mockResolvedValue(undefined);
      const mockFindById = vi.fn().mockResolvedValue(mockAsyncTask);
      const mockFindByIdAndTransform = vi.fn().mockResolvedValue(null);

      vi.mocked(AsyncTaskModel).mockImplementation(
        () =>
          ({
            checkTimeoutTasks: mockCheckTimeoutTasks,
            findById: mockFindById,
          }) as any,
      );
      vi.mocked(GenerationModel).mockImplementation(
        () =>
          ({
            findByIdAndTransform: mockFindByIdAndTransform,
          }) as any,
      );

      const caller = generationRouter.createCaller(mockCtx);

      await expect(
        caller.getGenerationStatus({
          generationId: 'gen-1',
          asyncTaskId: 'task-1',
        }),
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('retryVideoGenerationTask', () => {
    it('should retry a failed video task with the existing inference id', async () => {
      const mockGeneration = {
        id: 'gen-1',
        task: {
          id: 'task-1',
          status: AsyncTaskStatus.Success,
        },
      };
      const mockAsyncTask = {
        accessedAt: new Date('2024-01-01T00:00:00Z'),
        createdAt: new Date('2024-01-01T00:00:00Z'),
        duration: null,
        id: 'task-1',
        status: AsyncTaskStatus.Error,
        error: { message: 'Background polling failed: fetch failed' },
        inferenceId: 'upstream-task-1',
        metadata: {},
        parentId: null,
        type: AsyncTaskType.VideoGeneration,
        updatedAt: new Date('2024-01-01T00:00:00Z'),
        userId: 'test-user',
      } satisfies AsyncTaskSelectItem;
      const mockSyncedTask = {
        ...mockAsyncTask,
        error: null,
        status: AsyncTaskStatus.Success,
      } satisfies AsyncTaskSelectItem;
      const mockFindById = vi.fn().mockResolvedValue(mockAsyncTask);
      const mockFindGenerationById = vi.fn().mockResolvedValue({
        asyncTaskId: 'task-1',
        id: 'gen-1',
        userId: 'test-user',
      });
      const mockFindByIdAndTransform = vi.fn().mockResolvedValue(mockGeneration);
      const mockUpdate = vi.fn().mockResolvedValue(undefined);

      vi.mocked(AsyncTaskModel).mockImplementation(
        () =>
          ({
            findById: mockFindById,
            update: mockUpdate,
          }) as RetryAsyncTaskModelMock as AsyncTaskModel,
      );
      vi.mocked(GenerationModel).mockImplementation(
        () =>
          ({
            findById: mockFindGenerationById,
            findByIdAndTransform: mockFindByIdAndTransform,
          }) as RetryGenerationModelMock as GenerationModel,
      );
      vi.mocked(syncVideoGenerationTaskStatus).mockResolvedValue(mockSyncedTask);

      const caller = generationRouter.createCaller(mockCtx);

      const result = await caller.retryVideoGenerationTask({
        asyncTaskId: 'task-1',
        generationId: 'gen-1',
      });

      expect(mockUpdate).toHaveBeenCalledWith('task-1', {
        error: null,
        status: AsyncTaskStatus.Processing,
      });
      expect(syncVideoGenerationTaskStatus).toHaveBeenCalledWith({
        asyncTask: expect.objectContaining({
          id: 'task-1',
          inferenceId: 'upstream-task-1',
          status: AsyncTaskStatus.Processing,
          type: AsyncTaskType.VideoGeneration,
        }),
        db: expect.any(Object),
        generationId: 'gen-1',
        userId: 'test-user',
      });
      expect(result).toEqual({
        error: null,
        generation: mockGeneration,
        status: AsyncTaskStatus.Success,
      });
    });

    it('should reject retry when generation is not linked to the async task', async () => {
      const mockAsyncTask = {
        accessedAt: new Date('2024-01-01T00:00:00Z'),
        createdAt: new Date('2024-01-01T00:00:00Z'),
        duration: null,
        id: 'task-1',
        status: AsyncTaskStatus.Error,
        error: { message: 'Background polling failed: fetch failed' },
        inferenceId: 'upstream-task-1',
        metadata: {},
        parentId: null,
        type: AsyncTaskType.VideoGeneration,
        updatedAt: new Date('2024-01-01T00:00:00Z'),
        userId: 'test-user',
      } satisfies AsyncTaskSelectItem;
      const mockFindById = vi.fn().mockResolvedValue(mockAsyncTask);
      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      const mockFindGenerationById = vi.fn().mockResolvedValue({
        asyncTaskId: 'another-task',
        id: 'gen-1',
        userId: 'test-user',
      });

      vi.mocked(AsyncTaskModel).mockImplementation(
        () =>
          ({
            findById: mockFindById,
            update: mockUpdate,
          }) as RetryAsyncTaskModelMock as AsyncTaskModel,
      );
      vi.mocked(GenerationModel).mockImplementation(
        () =>
          ({
            findById: mockFindGenerationById,
            findByIdAndTransform: vi.fn(),
          }) as RetryGenerationModelMock as GenerationModel,
      );

      const caller = generationRouter.createCaller(mockCtx);

      await expect(
        caller.retryVideoGenerationTask({
          asyncTaskId: 'task-1',
          generationId: 'gen-1',
        }),
      ).rejects.toThrow(TRPCError);

      expect(mockUpdate).not.toHaveBeenCalled();
      expect(syncVideoGenerationTaskStatus).not.toHaveBeenCalled();
    });
  });

  describe('deleteGeneration', () => {
    it('should delete generation with thumbnail', async () => {
      const mockDeletedGeneration = {
        id: 'gen-1',
        asset: { thumbnailUrl: 'thumb-key' },
      };
      const mockDelete = vi.fn().mockResolvedValue(mockDeletedGeneration);
      const mockDeleteFile = vi.fn().mockResolvedValue(true);

      vi.mocked(GenerationModel).mockImplementation(
        () =>
          ({
            delete: mockDelete,
          }) as any,
      );
      vi.mocked(FileService).mockImplementation(
        () =>
          ({
            deleteFile: mockDeleteFile,
          }) as any,
      );

      const caller = generationRouter.createCaller(mockCtx);

      const result = await caller.deleteGeneration({ generationId: 'gen-1' });

      expect(result).toEqual(mockDeletedGeneration);
      expect(mockDelete).toHaveBeenCalledWith('gen-1');
      expect(mockDeleteFile).toHaveBeenCalledWith('thumb-key');
    });

    it('should delete generation without thumbnail', async () => {
      const mockDeletedGeneration = {
        id: 'gen-1',
        asset: { url: 'main-url' },
      };
      const mockDelete = vi.fn().mockResolvedValue(mockDeletedGeneration);
      const mockDeleteFile = vi.fn().mockResolvedValue(true);

      vi.mocked(GenerationModel).mockImplementation(
        () =>
          ({
            delete: mockDelete,
          }) as any,
      );
      vi.mocked(FileService).mockImplementation(
        () =>
          ({
            deleteFile: mockDeleteFile,
          }) as any,
      );

      const caller = generationRouter.createCaller(mockCtx);

      const result = await caller.deleteGeneration({ generationId: 'gen-1' });

      expect(result).toEqual(mockDeletedGeneration);
      expect(mockDelete).toHaveBeenCalledWith('gen-1');
      expect(mockDeleteFile).not.toHaveBeenCalled();
    });

    it('should handle when generation not found', async () => {
      const mockDelete = vi.fn().mockResolvedValue(null);
      const mockDeleteFile = vi.fn().mockResolvedValue(true);

      vi.mocked(GenerationModel).mockImplementation(
        () =>
          ({
            delete: mockDelete,
          }) as any,
      );
      vi.mocked(FileService).mockImplementation(
        () =>
          ({
            deleteFile: mockDeleteFile,
          }) as any,
      );

      const caller = generationRouter.createCaller(mockCtx);

      const result = await caller.deleteGeneration({ generationId: 'gen-1' });

      expect(result).toBeUndefined();
      expect(mockDelete).toHaveBeenCalledWith('gen-1');
      expect(mockDeleteFile).not.toHaveBeenCalled();
    });
  });
});
