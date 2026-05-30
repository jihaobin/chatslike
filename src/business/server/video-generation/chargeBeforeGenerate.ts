import { createHash } from 'node:crypto';

import { eq } from 'drizzle-orm';

import { getServerDB } from '@/database/core/db-adaptor';
import {
  asyncTasks,
  type GenerationBatchItem,
  type GenerationItem,
  generationBatches,
  generations,
} from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';
import type { CreateVideoServicePayload } from '@/server/routers/lambda/video';
import { AsyncTaskError, AsyncTaskStatus, AsyncTaskType } from '@/types/asyncTask';

import { CreditsService } from '../billing/credits';
import { calculateVideoCredits, getVideoPricing } from '../billing/pricing';
import { assertPrechargeRisk } from '../billing/risk';

const DEFAULT_VIDEO_DURATION_SECONDS = 5;

interface ChargeParams {
  generationTopicId: string;
  model: string;
  params: CreateVideoServicePayload['params'];
  provider: string;
  userId: string;
}

interface ErrorBatch {
  data: {
    batch: GenerationBatchItem;
    generations: GenerationItem[];
  };
  success: true;
}

interface ChargeBeforeResult {
  errorBatch?: ErrorBatch;
  prechargeResult?: {
    estimatedCredits: number;
    operationId: string;
    reservationId: string;
  };
}

const getDurationSeconds = (duration?: number) => {
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) {
    return DEFAULT_VIDEO_DURATION_SECONDS;
  }

  return Math.ceil(duration);
};

const createOperationId = (params: ChargeParams) => {
  const paramsHash = createHash('sha256')
    .update(JSON.stringify(params.params))
    .digest('hex')
    .slice(0, 16);

  return [
    'video',
    params.userId,
    params.generationTopicId,
    params.provider,
    params.model,
    paramsHash,
  ].join(':');
};

interface BillingPrechargeError {
  availableCredits?: unknown;
  code?: unknown;
  deficitCredits?: unknown;
  requiredCredits?: unknown;
}

const getBillingPrechargeError = (error: unknown): BillingPrechargeError | undefined => {
  if (!error || typeof error !== 'object') return undefined;

  const value = error as BillingPrechargeError;
  if (
    value.code === 'INSUFFICIENT_CREDITS' ||
    value.code === 'CREDIT_ACCOUNT_FROZEN' ||
    value.code === 'PHONE_VERIFICATION_REQUIRED'
  ) {
    return value;
  }

  return undefined;
};

const getBillingErrorDetail = (error: BillingPrechargeError) => {
  if (
    error.code === 'INSUFFICIENT_CREDITS' &&
    typeof error.requiredCredits === 'number' &&
    typeof error.availableCredits === 'number' &&
    typeof error.deficitCredits === 'number'
  ) {
    return `Insufficient credits: required ${error.requiredCredits}, available ${error.availableCredits}, deficit ${error.deficitCredits}`;
  }

  if (error.code === 'CREDIT_ACCOUNT_FROZEN') {
    return 'Credit account is frozen';
  }

  if (error.code === 'PHONE_VERIFICATION_REQUIRED') {
    return 'Phone verification is required';
  }

  return 'Video generation billing precharge failed';
};

const createBillingErrorBatch = async (
  db: LobeChatDatabase,
  params: ChargeParams,
  error: BillingPrechargeError,
): Promise<ErrorBatch> => {
  return db.transaction(async (tx) => {
    const [batch] = await tx
      .insert(generationBatches)
      .values({
        config: params.params,
        generationTopicId: params.generationTopicId,
        model: params.model,
        prompt: params.params.prompt,
        provider: params.provider,
        userId: params.userId,
      })
      .returning();

    const [generation] = await tx
      .insert(generations)
      .values({
        generationBatchId: batch.id,
        seed: params.params.seed ?? null,
        userId: params.userId,
      })
      .returning();

    const [asyncTask] = await tx
      .insert(asyncTasks)
      .values({
        error: new AsyncTaskError(String(error.code), getBillingErrorDetail(error)),
        metadata: {
          billingError: {
            availableCredits: error.availableCredits,
            code: error.code,
            deficitCredits: error.deficitCredits,
            requiredCredits: error.requiredCredits,
          },
        },
        status: AsyncTaskStatus.Error,
        type: AsyncTaskType.VideoGeneration,
        userId: params.userId,
      })
      .returning();

    const [generationWithTask] = await tx
      .update(generations)
      .set({ asyncTaskId: asyncTask.id })
      .where(eq(generations.id, generation.id))
      .returning();

    return {
      data: {
        batch,
        generations: [generationWithTask],
      },
      success: true,
    };
  });
};

export async function chargeBeforeGenerate(params: ChargeParams): Promise<ChargeBeforeResult> {
  const durationSeconds = getDurationSeconds(params.params.duration);
  const pricing = await getVideoPricing({
    model: params.model,
    parameters: {
      ...params.params,
      unit: 'second',
    },
    provider: params.provider,
  });
  const estimatedCredits = calculateVideoCredits({
    durationSeconds,
    fixedCreditsPerSecond: pricing.fixedCreditsPerUnit,
  });
  const operationId = createOperationId(params);
  const db = await getServerDB();
  const credits = new CreditsService(db, params.userId);
  let reservation;

  try {
    await assertPrechargeRisk({
      checkGenerationConcurrency: true,
      db,
      estimatedCredits,
      userId: params.userId,
    });
    reservation = await credits.reserveUsageCredits({
      businessId: params.generationTopicId,
      businessType: 'video',
      estimatedCredits,
      metadata: {
        durationSeconds,
        params: params.params as Record<string, unknown>,
      },
      model: params.model,
      operationId,
      provider: params.provider,
    });
  } catch (error) {
    const billingError = getBillingPrechargeError(error);
    if (billingError) {
      return { errorBatch: await createBillingErrorBatch(db, params, billingError) };
    }

    throw error;
  }

  return {
    prechargeResult: {
      estimatedCredits,
      operationId,
      reservationId: reservation.id,
    },
  };
}
