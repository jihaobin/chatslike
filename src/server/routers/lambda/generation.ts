import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { AsyncTaskModel } from '@/database/models/asyncTask';
import { GenerationModel } from '@/database/models/generation';
import type { AsyncTaskSelectItem } from '@/database/schemas';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import { FileService } from '@/server/services/file';
import { syncVideoGenerationTaskStatus } from '@/server/services/generation/videoTaskStatusSync';
import { type AsyncTaskError } from '@/types/asyncTask';
import { AsyncTaskStatus, AsyncTaskType } from '@/types/asyncTask';
import { type Generation } from '@/types/generation';

const generationProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: {
      asyncTaskModel: new AsyncTaskModel(ctx.serverDB, ctx.userId),
      fileService: new FileService(ctx.serverDB, ctx.userId),
      generationModel: new GenerationModel(ctx.serverDB, ctx.userId),
    },
  });
});

export type GetGenerationStatusResult = {
  error: AsyncTaskError | null;
  generation: Generation | null;
  status: AsyncTaskStatus;
};

export const generationRouter = router({
  deleteGeneration: generationProcedure
    .input(z.object({ generationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Delete the generation record from database and get the deleted data
      const deletedGeneration = await ctx.generationModel.delete(input.generationId);

      if (!deletedGeneration) return;

      // Note: Based on new requirements, don't delete main file (fileId), only delete thumbnail
      // If generation has a thumbnail, delete it from S3
      if (deletedGeneration.asset) {
        const asset = deletedGeneration.asset as any;

        // Only delete thumbnail URL if exists
        if (asset.thumbnailUrl) {
          await ctx.fileService.deleteFile(asset.thumbnailUrl);
        }
      }

      return deletedGeneration;
    }),

  getGenerationStatus: generationProcedure
    .input(z.object({ asyncTaskId: z.string(), generationId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Check for timeout tasks before querying
      await ctx.asyncTaskModel.checkTimeoutTasks([input.asyncTaskId]);

      let asyncTask: AsyncTaskSelectItem | undefined = await ctx.asyncTaskModel.findById(
        input.asyncTaskId,
      );
      if (!asyncTask) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Async task not found' });
      }

      if (
        asyncTask.type === AsyncTaskType.VideoGeneration &&
        asyncTask.inferenceId &&
        [AsyncTaskStatus.Pending, AsyncTaskStatus.Processing].includes(
          asyncTask.status as AsyncTaskStatus,
        )
      ) {
        asyncTask = await syncVideoGenerationTaskStatus({
          asyncTask,
          db: ctx.serverDB,
          generationId: input.generationId,
          userId: ctx.userId,
        });
      }

      const { status, error } = asyncTask;
      const result: GetGenerationStatusResult = {
        error: null,
        generation: null,
        status: status as AsyncTaskStatus,
      };

      if (
        asyncTask.status === AsyncTaskStatus.Success ||
        asyncTask.status === AsyncTaskStatus.Error
      ) {
        const generation = await ctx.generationModel.findByIdAndTransform(input.generationId);
        if (!generation) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Generation not found' });
        }

        result.generation = generation;
      }

      if (asyncTask.status === AsyncTaskStatus.Error) {
        result.error = error as AsyncTaskError;
      }

      return result;
    }),

  retryVideoGenerationTask: generationProcedure
    .input(z.object({ asyncTaskId: z.string(), generationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const asyncTask = await ctx.asyncTaskModel.findById(input.asyncTaskId);
      if (!asyncTask) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Async task not found' });
      }

      if (asyncTask.type !== AsyncTaskType.VideoGeneration) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Async task is not a video task' });
      }

      if (asyncTask.status !== AsyncTaskStatus.Error) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Async task is not failed' });
      }

      if (!asyncTask.inferenceId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Async task has no inference id' });
      }

      const generation = await ctx.generationModel.findById(input.generationId);
      if (!generation) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Generation not found' });
      }

      if (generation.asyncTaskId !== input.asyncTaskId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Generation is not linked to task' });
      }

      await ctx.asyncTaskModel.update(input.asyncTaskId, {
        error: null,
        status: AsyncTaskStatus.Processing,
      });

      const retriedTask = await syncVideoGenerationTaskStatus({
        asyncTask: {
          ...asyncTask,
          error: null,
          status: AsyncTaskStatus.Processing,
        },
        db: ctx.serverDB,
        generationId: input.generationId,
        userId: ctx.userId,
      });

      const result: GetGenerationStatusResult = {
        error: null,
        generation: null,
        status: retriedTask.status as AsyncTaskStatus,
      };

      if (
        retriedTask.status === AsyncTaskStatus.Success ||
        retriedTask.status === AsyncTaskStatus.Error
      ) {
        const generation = await ctx.generationModel.findByIdAndTransform(input.generationId);
        if (!generation) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Generation not found' });
        }

        result.generation = generation;
      }

      if (retriedTask.status === AsyncTaskStatus.Error) {
        result.error = retriedTask.error as AsyncTaskError;
      }

      return result;
    }),
});

export type GenerationRouter = typeof generationRouter;
