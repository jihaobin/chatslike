import { getServerDB } from '@/database/core/db-adaptor';

import { CreditsService } from '../billing/credits';
import { calculateTextCredits, getVideoPricing } from '../billing/pricing';

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

const getActualVideoCredits = async (params: {
  estimatedCredits: number;
  model: string;
  provider: string;
  usage?: { completionTokens: number; totalTokens: number };
}) => {
  if (!params.usage) return params.estimatedCredits;

  const pricing = await getVideoPricing({ model: params.model, provider: params.provider });
  if (
    typeof pricing.inputCreditsPerMillionTokens !== 'number' ||
    typeof pricing.outputCreditsPerMillionTokens !== 'number'
  ) {
    return params.estimatedCredits;
  }

  return calculateTextCredits({
    inputCreditsPerMillionTokens: pricing.inputCreditsPerMillionTokens,
    inputTokens: Math.max(0, params.usage.totalTokens - params.usage.completionTokens),
    outputCreditsPerMillionTokens: pricing.outputCreditsPerMillionTokens,
    outputTokens: params.usage.completionTokens,
  });
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

  const actualCredits = await getActualVideoCredits({
    estimatedCredits: prechargeResult.estimatedCredits,
    model: params.model,
    provider: params.provider,
    usage: params.usage,
  });
  const outputTokens = params.usage?.completionTokens ?? null;
  const inputTokens =
    params.usage?.totalTokens === undefined || outputTokens === null
      ? null
      : Math.max(params.usage.totalTokens - outputTokens, 0);

  const usageRecord = await credits.createUsageRecord({
    actualCredits,
    businessId: params.metadata.generationBatchId,
    estimatedCredits: prechargeResult.estimatedCredits,
    inputTokens,
    metadata: {
      asyncTaskId: params.metadata.asyncTaskId,
      latency: params.latency,
      topicId: params.metadata.topicId,
      usage: params.usage,
    },
    modality: 'video',
    model: params.metadata.modelId,
    outputTokens,
    params: params.computePriceParams ?? {},
    provider: params.provider,
    releasedCredits: 0,
    reservationId: prechargeResult.reservationId,
    status: 'captured',
  });

  await credits.captureUsageCredits({
    actualCredits,
    operationId: `${prechargeResult.operationId}:capture`,
    reservationId: prechargeResult.reservationId,
    usageRecordId: usageRecord.id,
  });
}
