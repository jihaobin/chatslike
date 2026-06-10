import { eq } from 'drizzle-orm';

import { getServerDB } from '@/database/core/db-adaptor';
import {
  asyncTasks,
  generationBatches,
  generations,
  type NewGeneration,
  type NewGenerationBatch,
} from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';
import { type CreateImageServicePayload } from '@/server/routers/lambda/image';
import { AsyncTaskError, AsyncTaskStatus, AsyncTaskType } from '@/types/asyncTask';

import { CreditsService } from '../billing/credits';
import {
  calculateImageCredits,
  estimateImageTokenCreditsForRequest,
  getImagePricing,
} from '../billing/pricing';
import { assertPrechargeRisk } from '../billing/risk';

interface ChargeParams {
  clientIp?: string | null;
  configForDatabase: CreateImageServicePayload['params'];
  generationParams: CreateImageServicePayload['params'];
  generationTopicId: string;
  imageNum: number;
  model: string;
  provider: string;
  userId: string;
}

interface ChargeBeforeResult {
  billing?: {
    estimatedCredits: number;
    operationId: string;
    pricingMode?: 'fixed' | 'token';
    reservationId: string;
  };
  errorBatch?: {
    data: {
      batch: NewGenerationBatch;
      generations: NewGeneration[];
    };
    success: true;
  };
}

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

  return 'Image generation billing precharge failed';
};

const createBillingErrorBatch = async (
  db: LobeChatDatabase,
  params: ChargeParams,
  error: BillingPrechargeError,
): Promise<NonNullable<ChargeBeforeResult['errorBatch']>> => {
  return db.transaction(async (tx) => {
    const [batch] = await tx
      .insert(generationBatches)
      .values({
        config: params.configForDatabase,
        generationTopicId: params.generationTopicId,
        height: params.configForDatabase.height,
        model: params.model,
        prompt: params.configForDatabase.prompt,
        provider: params.provider,
        userId: params.userId,
        width: params.configForDatabase.width,
      })
      .returning();

    const [generation] = await tx
      .insert(generations)
      .values({
        generationBatchId: batch.id,
        seed: params.configForDatabase.seed ?? null,
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
        type: AsyncTaskType.ImageGeneration,
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
  const pricing = await getImagePricing({
    model: params.model,
    parameters: {
      ...params.generationParams,
      quality: params.generationParams.quality ?? 'standard',
      size:
        params.generationParams.size ??
        (params.generationParams.width && params.generationParams.height
          ? `${params.generationParams.width}x${params.generationParams.height}`
          : undefined),
    },
    provider: params.provider,
  });
  const fixedCreditsPerUnit = pricing.fixedCreditsPerUnit;
  const isFixedPricing = typeof fixedCreditsPerUnit === 'number';
  let estimatedCredits: number;

  if (isFixedPricing) {
    estimatedCredits = calculateImageCredits({
      fixedCreditsPerUnit,
      imageNum: params.imageNum,
    });
  } else {
    const inputCreditsPerMillionTokens = pricing.inputCreditsPerMillionTokens;
    const outputCreditsPerMillionTokens = pricing.outputCreditsPerMillionTokens;

    if (
      typeof inputCreditsPerMillionTokens !== 'number' ||
      typeof outputCreditsPerMillionTokens !== 'number'
    ) {
      throw new Error('IMAGE_TOKEN_PRICING_REQUIRED');
    }

    estimatedCredits = estimateImageTokenCreditsForRequest({
      imageNum: params.imageNum,
      inputCreditsPerMillionTokens,
      outputCreditsPerMillionTokens,
      prompt: params.generationParams.prompt,
    });
  }
  const operationId = [
    'image',
    params.userId,
    params.generationTopicId,
    params.provider,
    params.model,
    JSON.stringify(params.generationParams),
  ].join(':');
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
      businessType: 'image',
      estimatedCredits,
      metadata: {
        clientIp: params.clientIp,
        imageNum: params.imageNum,
        params: params.generationParams as Record<string, unknown>,
        pricingMode: isFixedPricing ? 'fixed' : 'token',
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
    billing: {
      estimatedCredits,
      operationId,
      pricingMode: isFixedPricing ? 'fixed' : 'token',
      reservationId: reservation.id,
    },
  };
}
