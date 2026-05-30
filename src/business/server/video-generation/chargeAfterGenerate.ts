import { getServerDB } from '@/database/core/db-adaptor';

import { CreditsService } from '../billing/credits';

interface ChargeParams {
  computePriceParams?: { generateAudio?: boolean; resolution?: string };
  isError?: boolean;
  /** Total time from task submission to webhook callback (ms) */
  latency?: number;
  metadata: {
    asyncTaskId: string;
    generationBatchId: string;
    modelId: string;
    topicId?: string;
  };
  model: string;
  prechargeResult?: Record<string, unknown>;
  provider: string;
  usage?: { completionTokens: number; totalTokens: number };
  userId: string;
}

interface VideoPrechargeResult {
  estimatedCredits: number;
  operationId: string;
  reservationId: string;
}

const getVideoPrechargeResult = (
  prechargeResult?: Record<string, unknown>,
): VideoPrechargeResult | undefined => {
  if (!prechargeResult) return undefined;

  if (
    typeof prechargeResult.estimatedCredits !== 'number' ||
    typeof prechargeResult.operationId !== 'string' ||
    typeof prechargeResult.reservationId !== 'string'
  ) {
    return undefined;
  }

  return {
    estimatedCredits: prechargeResult.estimatedCredits,
    operationId: prechargeResult.operationId,
    reservationId: prechargeResult.reservationId,
  };
};

export async function chargeAfterGenerate(params: ChargeParams): Promise<void> {
  const prechargeResult = getVideoPrechargeResult(params.prechargeResult);
  if (!prechargeResult) return;

  const db = await getServerDB();
  const credits = new CreditsService(db, params.userId);

  if (params.isError) {
    await credits.releaseUsageCredits({
      operationId: `${prechargeResult.operationId}:release`,
      reason: 'video_generation_failed',
      reservationId: prechargeResult.reservationId,
    });
    return;
  }

  const usageRecord = await credits.createUsageRecord({
    actualCredits: prechargeResult.estimatedCredits,
    businessId: params.metadata.generationBatchId,
    estimatedCredits: prechargeResult.estimatedCredits,
    metadata: {
      asyncTaskId: params.metadata.asyncTaskId,
      latency: params.latency,
      topicId: params.metadata.topicId,
      usage: params.usage,
    },
    modality: 'video',
    model: params.metadata.modelId,
    params: params.computePriceParams ?? {},
    provider: params.provider,
    releasedCredits: 0,
    reservationId: prechargeResult.reservationId,
    status: 'captured',
  });

  await credits.captureUsageCredits({
    actualCredits: prechargeResult.estimatedCredits,
    operationId: `${prechargeResult.operationId}:capture`,
    reservationId: prechargeResult.reservationId,
    usageRecordId: usageRecord.id,
  });
}
