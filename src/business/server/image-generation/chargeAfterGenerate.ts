import { getServerDB } from '@/database/core/db-adaptor';
import { type ModelPerformance, type ModelUsage } from '@/types/index';

import { CreditsService } from '../billing/credits';
import { calculateImageTokenCredits, getImagePricing } from '../billing/pricing';

interface ChargeParams {
  metadata: {
    asyncTaskId: string;
    generationBatchId: string;
    modelId: string;
    topicId?: string;
  };
  metrics?: ModelPerformance;
  modelUsage?: ModelUsage;
  provider: string;
  success?: boolean;
  userId: string;
}

interface ImageBillingConfig {
  estimatedCredits: number;
  operationId: string;
  pricingMode?: 'fixed' | 'token';
  reservationId: string;
}

const getImageBillingConfig = (config: unknown): ImageBillingConfig | undefined => {
  if (!config || typeof config !== 'object') return undefined;

  const billing = (config as { billing?: Partial<ImageBillingConfig> }).billing;
  if (!billing) return undefined;

  if (
    typeof billing.estimatedCredits !== 'number' ||
    typeof billing.operationId !== 'string' ||
    typeof billing.reservationId !== 'string'
  ) {
    return undefined;
  }

  return {
    estimatedCredits: billing.estimatedCredits,
    operationId: billing.operationId,
    pricingMode:
      billing.pricingMode === 'fixed' || billing.pricingMode === 'token'
        ? billing.pricingMode
        : undefined,
    reservationId: billing.reservationId,
  };
};

const getUsageTokens = (usage?: ModelUsage) => {
  if (!usage) return { cachedInputTokens: 0, inputTokens: 0, outputTokens: 0 };

  const inputTokens =
    usage.totalInputTokens ??
    (usage.inputTextTokens ?? 0) +
      (usage.inputImageTokens ?? 0) +
      (usage.inputAudioTokens ?? 0) +
      (usage.inputVideoTokens ?? 0);
  const outputTokens =
    usage.totalOutputTokens ??
    (usage.outputTextTokens ?? 0) +
      (usage.outputImageTokens ?? 0) +
      (usage.outputAudioTokens ?? 0) +
      (usage.outputReasoningTokens ?? 0);
  const cachedInputTokens =
    usage.inputCachedTokens ??
    (usage.inputCachedTextTokens ?? 0) +
      (usage.inputCachedImageTokens ?? 0) +
      (usage.inputCachedAudioTokens ?? 0) +
      (usage.inputCachedVideoTokens ?? 0);

  return {
    cachedInputTokens,
    inputTokens,
    outputTokens,
  };
};

const getUsageDurationMs = (metrics?: ModelPerformance) => {
  for (const value of [metrics?.duration, metrics?.latency]) {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  }
};

const getActualImageCredits = async (params: {
  estimatedCredits: number;
  model: string;
  pricingMode?: 'fixed' | 'token';
  provider: string;
  usage?: ModelUsage;
}) => {
  if (!params.usage || params.pricingMode !== 'token') return params.estimatedCredits;

  const pricing = await getImagePricing({ model: params.model, provider: params.provider });
  if (
    typeof pricing.inputCreditsPerMillionTokens !== 'number' ||
    typeof pricing.outputCreditsPerMillionTokens !== 'number'
  ) {
    return params.estimatedCredits;
  }

  const usageTokens = getUsageTokens(params.usage);

  return calculateImageTokenCredits({
    cachedInputTokens: usageTokens.cachedInputTokens,
    inputCreditsPerMillionTokens: pricing.inputCreditsPerMillionTokens,
    inputTokens: usageTokens.inputTokens,
    outputCreditsPerMillionTokens: pricing.outputCreditsPerMillionTokens,
    outputTokens: usageTokens.outputTokens,
  });
};

export async function chargeAfterGenerate(params: ChargeParams): Promise<void> {
  const db = await getServerDB();
  const batch = await db.query.generationBatches.findFirst({
    columns: { config: true, model: true },
    where: (table, { eq }) => eq(table.id, params.metadata.generationBatchId),
  });
  const billing = getImageBillingConfig(batch?.config);

  if (!billing) return;

  const credits = new CreditsService(db, params.userId);

  if (params.success === false) {
    await credits.releaseUsageCredits({
      operationId: `${billing.operationId}:release`,
      reason: 'image_generation_failed',
      reservationId: billing.reservationId,
    });
    return;
  }

  const actualCredits = await getActualImageCredits({
    estimatedCredits: billing.estimatedCredits,
    model: params.metadata.modelId,
    pricingMode: billing.pricingMode,
    provider: params.provider,
    usage: params.modelUsage,
  });
  const usageTokens = getUsageTokens(params.modelUsage);
  const durationMs = getUsageDurationMs(params.metrics);

  const usageRecord = await credits.createUsageRecord({
    actualCredits,
    businessId: params.metadata.generationBatchId,
    estimatedCredits: billing.estimatedCredits,
    inputTokens: usageTokens.inputTokens,
    metadata: {
      asyncTaskId: params.metadata.asyncTaskId,
      durationMs,
      metrics: params.metrics,
      modelUsage: params.modelUsage,
      topicId: params.metadata.topicId,
    },
    modality: 'image',
    model: params.metadata.modelId,
    outputTokens: usageTokens.outputTokens,
    params: {},
    provider: params.provider,
    releasedCredits: 0,
    reservationId: billing.reservationId,
    status: 'captured',
  });

  await credits.captureUsageCredits({
    actualCredits,
    operationId: `${billing.operationId}:capture`,
    reservationId: billing.reservationId,
    usageRecordId: usageRecord.id,
  });
}
