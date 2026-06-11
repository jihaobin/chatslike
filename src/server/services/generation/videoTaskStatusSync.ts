import { and, eq, inArray, or, sql } from 'drizzle-orm';

import { AsyncTaskModel } from '@/database/models/asyncTask';
import type { AsyncTaskSelectItem } from '@/database/schemas';
import { asyncTasks, generationBatches, generations } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';
import { initModelRuntimeFromDB } from '@/server/modules/ModelRuntime';
import { AsyncTaskStatus, AsyncTaskType } from '@/types/asyncTask';

import {
  type BackgroundPollingParams,
  markVideoGenerationFailed,
  processCompletedVideoGeneration,
} from './videoBackgroundPolling';

const VIDEO_STATUS_SYNC_STALE_MS = 10 * 60 * 1000;

type VideoTaskRuntime = {
  handlePollVideoStatus: (
    inferenceId: string,
  ) => Promise<
    | { error?: string; status: 'failed' }
    | { headers?: Record<string, string>; status: 'success'; videoUrl: string }
    | { status: 'pending' | 'processing' }
    | undefined
  >;
};

interface SyncVideoGenerationTaskStatusParams {
  asyncTask: AsyncTaskSelectItem;
  db: LobeChatDatabase;
  generationId: string;
  userId: string;
}

export async function syncVideoGenerationTaskStatus({
  asyncTask,
  db,
  generationId,
  userId,
}: SyncVideoGenerationTaskStatusParams): Promise<AsyncTaskSelectItem> {
  if (asyncTask.type !== AsyncTaskType.VideoGeneration) return asyncTask;
  if (![AsyncTaskStatus.Pending, AsyncTaskStatus.Processing].includes(asyncTask.status as any)) {
    return asyncTask;
  }
  if (!asyncTask.inferenceId) return asyncTask;

  const generation = await db.query.generations.findFirst({
    where: and(
      eq(generations.id, generationId),
      eq(generations.asyncTaskId, asyncTask.id),
      eq(generations.userId, userId),
    ),
  });

  if (!generation) return asyncTask;

  const batch = await db.query.generationBatches.findFirst({
    where: and(
      eq(generationBatches.id, generation.generationBatchId),
      eq(generationBatches.userId, userId),
    ),
  });

  if (!batch) return asyncTask;

  const runtime = (await initModelRuntimeFromDB(db, userId, batch.provider)) as VideoTaskRuntime;
  const pollResult = await runtime.handlePollVideoStatus(asyncTask.inferenceId);

  if (!pollResult || pollResult.status === 'pending' || pollResult.status === 'processing') {
    return asyncTask;
  }

  const claimed = await claimVideoStatusSync(db, asyncTask, userId);
  if (!claimed) return asyncTask;

  const pollingParams: BackgroundPollingParams = {
    asyncTaskCreatedAt: asyncTask.createdAt,
    asyncTaskId: asyncTask.id,
    generationBatchId: generation.generationBatchId,
    generationId: generation.id,
    generationTopicId: batch.generationTopicId,
    inferenceId: asyncTask.inferenceId,
    model: batch.model,
    prechargeResult: (asyncTask.metadata as { precharge?: Record<string, unknown> } | undefined)
      ?.precharge,
    provider: batch.provider,
    userId,
  };

  try {
    if (pollResult.status === 'success') {
      await processCompletedVideoGeneration(db, pollingParams, pollResult);
    } else if (pollResult.status === 'failed') {
      await markVideoGenerationFailed(
        db,
        pollingParams,
        new Error(`Video generation failed: ${pollResult.error}`),
      );
    }
  } catch (error) {
    await markVideoGenerationFailed(db, pollingParams, error);
  }

  const updatedTask = await new AsyncTaskModel(db, userId).findById(asyncTask.id);
  return updatedTask ?? asyncTask;
}

async function claimVideoStatusSync(
  db: LobeChatDatabase,
  asyncTask: AsyncTaskSelectItem,
  userId: string,
) {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - VIDEO_STATUS_SYNC_STALE_MS).toISOString();

  const [claimedTask] = await db
    .update(asyncTasks)
    .set({
      metadata: sql`
        jsonb_set(
          COALESCE(${asyncTasks.metadata}, '{}'::jsonb),
          '{videoStatusSync}',
          ${JSON.stringify({ startedAt: now.toISOString() })}::jsonb,
          true
        )
      `,
      updatedAt: now,
    })
    .where(
      and(
        eq(asyncTasks.id, asyncTask.id),
        eq(asyncTasks.userId, userId),
        inArray(asyncTasks.status, [AsyncTaskStatus.Pending, AsyncTaskStatus.Processing]),
        or(
          sql`NOT (COALESCE(${asyncTasks.metadata}, '{}'::jsonb) ? 'videoStatusSync')`,
          sql`(
            COALESCE(${asyncTasks.metadata}, '{}'::jsonb)
              -> 'videoStatusSync'
              ->> 'startedAt'
          )::timestamptz < ${staleBefore}::timestamptz`,
        ),
      ),
    )
    .returning({ id: asyncTasks.id });

  return Boolean(claimedTask);
}
