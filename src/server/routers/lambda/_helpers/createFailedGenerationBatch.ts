import { eq } from 'drizzle-orm';

import { asyncTasks, generationBatches, generations } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';
import type { AsyncTaskError, AsyncTaskType } from '@/types/asyncTask';
import { AsyncTaskStatus } from '@/types/asyncTask';

interface CreateFailedGenerationBatchParams {
  asyncTaskType: AsyncTaskType.ImageGeneration | AsyncTaskType.VideoGeneration;
  config: Record<string, unknown>;
  error: AsyncTaskError;
  generationTopicId: string;
  height?: number | null;
  imageNum?: number;
  model: string;
  prompt: string;
  provider: string;
  serverDB: LobeChatDatabase;
  userId: string;
  width?: number | null;
}

export const createFailedGenerationBatch = async ({
  asyncTaskType,
  config,
  error,
  generationTopicId,
  height,
  imageNum = 1,
  model,
  prompt,
  provider,
  serverDB,
  userId,
  width,
}: CreateFailedGenerationBatchParams) => {
  return serverDB.transaction(async (tx) => {
    const [batch] = await tx
      .insert(generationBatches)
      .values({
        config,
        generationTopicId,
        height,
        model,
        prompt,
        provider,
        userId,
        width,
      })
      .returning();

    const createdGenerations = await tx
      .insert(generations)
      .values(
        Array.from({ length: imageNum }, () => ({
          generationBatchId: batch.id,
          userId,
        })),
      )
      .returning();

    const generationsWithTasks = await Promise.all(
      createdGenerations.map(async (generation) => {
        const [task] = await tx
          .insert(asyncTasks)
          .values({
            error,
            status: AsyncTaskStatus.Error,
            type: asyncTaskType,
            userId,
          })
          .returning();

        await tx
          .update(generations)
          .set({ asyncTaskId: task.id })
          .where(eq(generations.id, generation.id));

        return {
          ...generation,
          asyncTaskId: task.id,
          task: {
            ...task,
            error,
            status: AsyncTaskStatus.Error,
            type: asyncTaskType,
          },
        };
      }),
    );

    return {
      data: {
        batch,
        generations: generationsWithTasks,
      },
      success: true as const,
    };
  });
};
