import { and, eq } from 'drizzle-orm';
import { ModelProvider } from 'model-bank';

import { ModelPricingService } from '@/business/server/billing/pricing';
import { AiProviderModel } from '@/database/models/aiProvider';
import { aiModels, type UsageModality } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';
import { KeyVaultsGateKeeper } from '@/server/modules/KeyVaultsEncrypt';

import { GLOBAL_PROVIDER_CONFIG_USER_ID } from './constants';

export const PLATFORM_PROVIDER_DISABLED = 'PLATFORM_PROVIDER_DISABLED';
export const PLATFORM_MODEL_DISABLED = 'PLATFORM_MODEL_DISABLED';
export const PLATFORM_MODEL_CREDENTIAL_MISSING = 'PLATFORM_MODEL_CREDENTIAL_MISSING';

export interface AssertGlobalProviderModelAvailableParams {
  db: LobeChatDatabase;
  modality?: UsageModality;
  model: string;
  provider: string;
  requirePricing?: boolean;
}

const isNonEmptyString = (value: unknown) => typeof value === 'string' && value.trim().length > 0;

const isNonEmptyRecord = (value: unknown) =>
  !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0;

export const hasGlobalProviderCredential = (provider: string, keyVaults: unknown) => {
  if (typeof keyVaults === 'string') return keyVaults.trim().length > 0;
  if (!keyVaults || typeof keyVaults !== 'object' || Array.isArray(keyVaults)) return false;

  const vaults = keyVaults as Record<string, unknown>;

  switch (provider) {
    case ModelProvider.Ollama: {
      return isNonEmptyString(vaults.baseURL);
    }

    case ModelProvider.Bedrock: {
      return isNonEmptyString(vaults.accessKeyId) && isNonEmptyString(vaults.secretAccessKey);
    }

    case ModelProvider.Cloudflare: {
      return isNonEmptyString(vaults.apiKey);
    }

    case ModelProvider.ComfyUI: {
      if (!isNonEmptyString(vaults.baseURL)) return false;

      switch (vaults.authType) {
        case 'none': {
          return true;
        }

        case 'basic': {
          return isNonEmptyString(vaults.username) && isNonEmptyString(vaults.password);
        }

        case 'bearer': {
          return isNonEmptyString(vaults.apiKey);
        }

        case 'custom': {
          return isNonEmptyRecord(vaults.customHeaders);
        }

        default: {
          return false;
        }
      }
    }

    case ModelProvider.VertexAI: {
      return isNonEmptyString(vaults.apiKey);
    }

    default: {
      return isNonEmptyString(vaults.apiKey);
    }
  }
};

const resolveCredentialProvider = (provider: string, sdkType?: string) => {
  const isBuiltin = Object.values(ModelProvider).includes(provider as ModelProvider);
  if (isBuiltin) return provider;

  return sdkType || provider;
};

const createRuntimeGuardError = (code: string, meta: Record<string, unknown>) =>
  Object.assign(new Error(code), { code, meta });

export const assertGlobalProviderModelAvailable = async (
  params: AssertGlobalProviderModelAvailableParams,
) => {
  const provider = await new AiProviderModel(
    params.db,
    GLOBAL_PROVIDER_CONFIG_USER_ID,
  ).getAiProviderById(params.provider, KeyVaultsGateKeeper.getUserKeyVaults);

  if (!provider || provider.enabled === false) {
    throw createRuntimeGuardError(PLATFORM_PROVIDER_DISABLED, { provider: params.provider });
  }

  const credentialProvider = resolveCredentialProvider(params.provider, provider.settings?.sdkType);

  if (!hasGlobalProviderCredential(credentialProvider, provider.keyVaults)) {
    throw createRuntimeGuardError(PLATFORM_MODEL_CREDENTIAL_MISSING, { provider: params.provider });
  }

  const [model] = await params.db
    .select({ enabled: aiModels.enabled })
    .from(aiModels)
    .where(
      and(
        eq(aiModels.id, params.model),
        eq(aiModels.providerId, params.provider),
        eq(aiModels.userId, GLOBAL_PROVIDER_CONFIG_USER_ID),
      ),
    )
    .limit(1);

  if (!model || model.enabled === false) {
    throw createRuntimeGuardError(PLATFORM_MODEL_DISABLED, {
      model: params.model,
      provider: params.provider,
    });
  }

  if (params.requirePricing && params.modality) {
    await new ModelPricingService(params.db).findActivePricing({
      modality: params.modality,
      model: params.model,
      provider: params.provider,
    });
  }
};
