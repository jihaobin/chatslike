import { getServerDB } from '@/database/core/db-adaptor';
import { type ModelPerformance, type ModelUsage } from '@/types/index';

import { CreditsService } from '../billing/credits';

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
    reservationId: billing.reservationId,
  };
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

  const usageRecord = await credits.createUsageRecord({
    actualCredits: billing.estimatedCredits,
    businessId: params.metadata.generationBatchId,
    estimatedCredits: billing.estimatedCredits,
    metadata: {
      asyncTaskId: params.metadata.asyncTaskId,
      metrics: params.metrics,
      modelUsage: params.modelUsage,
      topicId: params.metadata.topicId,
    },
    modality: 'image',
    model: params.metadata.modelId,
    params: {},
    provider: params.provider,
    releasedCredits: 0,
    reservationId: billing.reservationId,
    status: 'captured',
  });

  await credits.captureUsageCredits({
    actualCredits: billing.estimatedCredits,
    operationId: `${billing.operationId}:capture`,
    reservationId: billing.reservationId,
    usageRecordId: usageRecord.id,
  });
}
