import { lambdaClient } from '@/libs/trpc/client';

export interface ProviderPricingListParams {
  modality?: 'text' | 'image' | 'video';
  model: string;
  provider: string;
  scope?: 'global' | 'user';
}

export interface CreateProviderPriceVersionParams extends ProviderPricingListParams {
  currency?: string;
  effectiveAt?: Date;
  fixedCreditsPerUnit?: number;
  inputCreditsPerMillionTokens?: number;
  outputCreditsPerMillionTokens?: number;
  parameterRules?: Record<string, unknown>;
  priceKey?: string;
  reason: string;
  unit?: string;
}

export interface ProviderPricingRecord {
  createdAt?: Date | string;
  currency?: string | null;
  effectiveAt?: Date | string | null;
  fixedCreditsPerUnit?: number | null;
  id: string;
  inputCreditsPerMillionTokens?: number | null;
  modality?: string | null;
  model: string;
  outputCreditsPerMillionTokens?: number | null;
  priceKey?: string | null;
  provider: string;
  status?: string | null;
  unit?: string | null;
}

class ProviderPricingService {
  listModelPricing = async (params: ProviderPricingListParams): Promise<ProviderPricingRecord[]> => {
    const { data } = await lambdaClient.providerPricing.listModelPricing.query(params);
    return data;
  };

  createModelPricingVersion = async (
    params: CreateProviderPriceVersionParams,
  ): Promise<ProviderPricingRecord> => {
    const { data } = await lambdaClient.providerPricing.createModelPricingVersion.mutate(params);
    return data;
  };

  retireModelPricingVersion = async (params: {
    id: string;
    reason: string;
    scope?: 'global' | 'user';
  }): Promise<ProviderPricingRecord> => {
    const { data } = await lambdaClient.providerPricing.retireModelPricingVersion.mutate(params);
    return data;
  };
}

export const providerPricingService = new ProviderPricingService();
