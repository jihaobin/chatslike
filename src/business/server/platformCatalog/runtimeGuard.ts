import { and, eq } from 'drizzle-orm';

import type { UsageModality } from '@/database/schemas';
import { aiModels, aiProviders } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';
import { getLLMConfig } from '@/envs/llm';

import { BillingError } from '../billing/errors';
import { ModelPricingService } from '../billing/pricing';
import { NEWAPI_CREDENTIAL_KEYS, NEWAPI_PROVIDER_ID, PLATFORM_CATALOG_USER_ID } from './constants';

export interface NewApiPlatformModelGuardParams {
  db: LobeChatDatabase;
  llmConfig?: Record<string, unknown>;
  modality?: UsageModality;
  model: string;
  requirePricing?: boolean;
  userId: string;
}

const isNonEmptyString = (value: unknown) => typeof value === 'string' && value.trim().length > 0;

export async function assertNewApiPlatformModelAvailable(params: NewApiPlatformModelGuardParams) {
  const [provider] = await params.db
    .select()
    .from(aiProviders)
    .where(
      and(eq(aiProviders.id, NEWAPI_PROVIDER_ID), eq(aiProviders.userId, PLATFORM_CATALOG_USER_ID)),
    )
    .limit(1);

  if (provider?.enabled === false) {
    throw new BillingError('PLATFORM_PROVIDER_DISABLED', 'Platform provider is disabled', {
      provider: NEWAPI_PROVIDER_ID,
      userId: params.userId,
    });
  }

  const [model] = await params.db
    .select()
    .from(aiModels)
    .where(
      and(
        eq(aiModels.id, params.model),
        eq(aiModels.providerId, NEWAPI_PROVIDER_ID),
        eq(aiModels.userId, PLATFORM_CATALOG_USER_ID),
      ),
    )
    .limit(1);

  if (!model || model.enabled === false) {
    throw new BillingError('PLATFORM_MODEL_DISABLED', 'Platform model is disabled', {
      model: params.model,
      provider: NEWAPI_PROVIDER_ID,
      userId: params.userId,
    });
  }

  const llmConfig = params.llmConfig ?? (getLLMConfig() as Record<string, unknown>);
  const missingKeys = NEWAPI_CREDENTIAL_KEYS.filter((key) => !isNonEmptyString(llmConfig[key]));

  if (missingKeys.length > 0) {
    throw new BillingError(
      'PLATFORM_MODEL_CREDENTIAL_MISSING',
      'Platform hosted model credential is missing',
      {
        credentials: missingKeys,
        provider: NEWAPI_PROVIDER_ID,
        userId: params.userId,
      },
    );
  }

  if (params.requirePricing && params.modality) {
    await new ModelPricingService(params.db).findActivePricing({
      modality: params.modality,
      model: params.model,
      provider: NEWAPI_PROVIDER_ID,
    });
  }
}
