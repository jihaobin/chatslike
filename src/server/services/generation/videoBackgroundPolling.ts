import { buildMappedBusinessModelFields } from '@lobechat/business-model-runtime';
import { RequestTrigger } from '@lobechat/types';
import debug from 'debug';

import { getProviderContentPolicyErrorMessage } from '@/business/server/getProviderContentPolicyErrorMessage';
import { trackProviderContentPolicyViolation } from '@/business/server/trackProviderContentPolicyViolation';
import { chargeAfterGenerate } from '@/business/server/video-generation/chargeAfterGenerate';
import { AsyncTaskModel } from '@/database/models/asyncTask';
import { GenerationModel } from '@/database/models/generation';
import type { LobeChatDatabase } from '@/database/type';
import { initModelRuntimeFromDB } from '@/server/modules/ModelRuntime';
import { VideoGenerationService } from '@/server/services/generation/video';
import { AsyncTaskError, AsyncTaskErrorType, AsyncTaskStatus } from '@/types/asyncTask';
import { FileSource } from '@/types/files';
import type { VideoGenerationAsset } from '@/types/generation';
import { sanitizeFileName } from '@/utils/sanitizeFileName';

import {
  VIDEO_GENERATION_MAX_RETRIES,
  VIDEO_GENERATION_POLLING_INTERVAL,
} from './videoPollingConfig';

const log = debug('lobe-video:background-polling');

export interface BackgroundPollingParams {
  asyncTaskCreatedAt: Date;
  asyncTaskId: string;
  generationBatchId: string;
  generationId: string;
  generationTopicId: string;
  inferenceId: string;
  model: string;
  prechargeResult?: Record<string, unknown>;
  provider: string;
  userId: string;
}

interface VideoComputePriceParams {
  generateAudio?: boolean;
  resolution?: string;
}

type PollVideoStatusResult =
  | {
      headers?: Record<string, string>;
      status: 'success';
      videoUrl: string;
    }
  | {
      error?: string;
      status: 'failed';
    }
  | {
      status: 'pending' | 'processing';
    };

interface VideoPollingRuntime {
  handlePollVideoStatus: (inferenceId: string) => Promise<PollVideoStatusResult | undefined>;
}

export interface CompletedVideoPollingResult {
  headers?: Record<string, string>;
  videoUrl: string;
}

const getVideoComputePriceParams = (config: unknown): VideoComputePriceParams => {
  if (!config || typeof config !== 'object') return {};

  const value = config as { generateAudio?: unknown; resolution?: unknown };

  return {
    ...(typeof value.generateAudio === 'boolean' ? { generateAudio: value.generateAudio } : {}),
    ...(typeof value.resolution === 'string' ? { resolution: value.resolution } : {}),
  };
};

export async function processBackgroundVideoPolling(
  db: LobeChatDatabase,
  params: BackgroundPollingParams,
): Promise<void> {
  const {
    asyncTaskCreatedAt,
    asyncTaskId,
    generationBatchId,
    generationId,
    generationTopicId,
    inferenceId,
    model,
    prechargeResult,
    provider,
    userId,
  } = params;

  log(
    'Starting background video polling for task: %s (provider: %s, inferenceId: %s)',
    asyncTaskId,
    provider,
    inferenceId,
  );

  try {
    const modelRuntime = await initModelRuntimeFromDB(db, userId, provider);
    const pollResult = await pollUntilCompletion(modelRuntime, inferenceId);

    if (!pollResult) {
      throw new Error('Polling completed but no video URL returned');
    }

    await processCompletedVideoGeneration(db, params, pollResult);
  } catch (error) {
    await markVideoGenerationFailed(db, params, error);
  }
}

export async function processCompletedVideoGeneration(
  db: LobeChatDatabase,
  params: BackgroundPollingParams,
  pollResult: CompletedVideoPollingResult,
): Promise<void> {
  const {
    asyncTaskCreatedAt,
    asyncTaskId,
    generationBatchId,
    generationId,
    generationTopicId,
    model,
    prechargeResult,
    provider,
    userId,
  } = params;

  const asyncTaskModel = new AsyncTaskModel(db, userId);
  const videoService = new VideoGenerationService(db, userId);
  const generationModel = new GenerationModel(db, userId);

  log('Video polling succeeded for task: %s, processing video...', asyncTaskId);

  const processResult = await videoService.processVideoForGeneration(pollResult.videoUrl, {
    headers: pollResult.headers,
  });

  const asset: VideoGenerationAsset = {
    coverUrl: processResult.coverKey,
    duration: processResult.duration,
    height: processResult.height,
    originalUrl: pollResult.videoUrl,
    thumbnailUrl: processResult.thumbnailKey,
    type: 'video',
    url: processResult.videoKey,
    width: processResult.width,
  };

  const batch = await db.query.generationBatches.findFirst({
    where: (batches, { eq }) => eq(batches.id, generationBatchId),
  });

  await generationModel.createAssetAndFile(
    generationId,
    asset,
    {
      fileHash: processResult.fileHash,
      fileType: processResult.mimeType,
      name: `${sanitizeFileName(batch?.prompt ?? '', generationId)}.mp4`,
      size: processResult.fileSize,
      url: processResult.videoKey,
    },
    FileSource.VideoGeneration,
  );

  const duration = Date.now() - asyncTaskCreatedAt.getTime();

  await asyncTaskModel.update(asyncTaskId, {
    duration,
    status: AsyncTaskStatus.Success,
  });

  if (prechargeResult) {
    try {
      await chargeAfterGenerate({
        computePriceParams: getVideoComputePriceParams(batch?.config),
        latency: duration,
        metadata: {
          asyncTaskId,
          generationBatchId,
          topicId: batch?.generationTopicId ?? generationTopicId,
          ...buildMappedBusinessModelFields({
            provider,
            resolvedModelId: model,
          }),
        },
        model,
        prechargeResult,
        provider,
        userId,
      });
    } catch (chargeError) {
      console.error('[video-polling] Failed to charge after generate:', chargeError);
    }
  }

  log('Video processing completed successfully for task: %s', asyncTaskId);
}

export async function markVideoGenerationFailed(
  db: LobeChatDatabase,
  params: BackgroundPollingParams,
  error: unknown,
): Promise<void> {
  const {
    asyncTaskId,
    generationBatchId,
    generationTopicId,
    model,
    prechargeResult,
    provider,
    userId,
  } = params;

  log('Background video polling error for task: %s', asyncTaskId, error);

  const asyncTaskModel = new AsyncTaskModel(db, userId);
  const providerContentPolicyMessage = await getProviderContentPolicyErrorMessage({
    error,
    provider,
    trigger: RequestTrigger.Video,
    userId,
  });
  if (providerContentPolicyMessage) {
    try {
      await trackProviderContentPolicyViolation({
        error,
        model,
        provider,
        trigger: 'video-polling',
        userId,
      });
    } catch (trackError) {
      log('Failed to track provider content policy violation: %O', trackError);
    }
  }
  await asyncTaskModel.update(asyncTaskId, {
    error: new AsyncTaskError(
      providerContentPolicyMessage
        ? AsyncTaskErrorType.ProviderContentModeration
        : AsyncTaskErrorType.ServerError,
      providerContentPolicyMessage ??
        'Background polling failed: ' + (error instanceof Error ? error.message : 'Unknown error'),
    ),
    status: AsyncTaskStatus.Error,
  });

  if (prechargeResult) {
    try {
      await chargeAfterGenerate({
        isError: true,
        metadata: {
          asyncTaskId,
          generationBatchId,
          topicId: generationTopicId,
          ...buildMappedBusinessModelFields({
            provider,
            resolvedModelId: model,
          }),
        },
        model,
        prechargeResult,
        provider,
        userId,
      });
    } catch (chargeError) {
      console.error('[video-polling] Failed to refund precharge on error:', chargeError);
    }
  }
}

async function pollUntilCompletion(
  modelRuntime: VideoPollingRuntime,
  inferenceId: string,
): Promise<{ headers?: Record<string, string>; videoUrl: string } | null> {
  const maxRetries = VIDEO_GENERATION_MAX_RETRIES;
  const pollingInterval = VIDEO_GENERATION_POLLING_INTERVAL;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      log('Polling attempt %d/%d for task: %s', attempt + 1, maxRetries, inferenceId);

      const result = await modelRuntime.handlePollVideoStatus(inferenceId);

      if (!result) {
        throw new Error('Video status polling is not supported by this provider');
      }

      if (result.status === 'success') {
        log('Video generation succeeded for task: %s', inferenceId);
        return { headers: result.headers, videoUrl: result.videoUrl };
      }

      if (result.status === 'failed') {
        throw new Error(`Video generation failed: ${result.error}`);
      }

      log('Task %s still in progress', inferenceId);
      await sleep(pollingInterval);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Video generation failed:')) {
        throw error;
      }
      log('Polling attempt %d failed for task: %s: %O', attempt + 1, inferenceId, error);
      await sleep(pollingInterval);
    }
  }

  throw new Error(
    `Video generation timeout after ${maxRetries} attempts (${(maxRetries * pollingInterval) / 1000}s)`,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
