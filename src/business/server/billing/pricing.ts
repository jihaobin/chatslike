import { and, desc, eq, lte } from 'drizzle-orm';

import { getServerDB } from '@/database/core/db-adaptor';
import type { LobeChatDatabase } from '@/database/type';
import type { ModelPricingItem, NewModelPricing, UsageModality } from '@/database/schemas';
import { modelPricing } from '@/database/schemas';

import { PricingNotFoundError } from './errors';

interface TextCreditsParams {
  inputCreditsPerMillionTokens: number;
  inputTokens: number;
  outputCreditsPerMillionTokens: number;
  outputTokens: number;
}

export function calculateTextCredits(params: TextCreditsParams) {
  const input = (params.inputTokens * params.inputCreditsPerMillionTokens) / 1_000_000;
  const output = (params.outputTokens * params.outputCreditsPerMillionTokens) / 1_000_000;
  return Math.ceil(input + output);
}

export function estimateTextCreditsForRequest(params: {
  inputCreditsPerMillionTokens: number;
  maxOutputTokens?: number;
  outputCreditsPerMillionTokens: number;
  promptTokensEstimate: number;
}) {
  const reservedOutputTokens = params.maxOutputTokens ?? 4096;

  return calculateTextCredits({
    inputCreditsPerMillionTokens: params.inputCreditsPerMillionTokens,
    inputTokens: params.promptTokensEstimate,
    outputCreditsPerMillionTokens: params.outputCreditsPerMillionTokens,
    outputTokens: reservedOutputTokens,
  });
}

export function calculateImageCredits(params: { fixedCreditsPerUnit: number; imageNum: number }) {
  return params.fixedCreditsPerUnit * params.imageNum;
}

export function calculateVideoCredits(params: {
  durationSeconds: number;
  fixedCreditsPerSecond: number;
}) {
  return params.durationSeconds * params.fixedCreditsPerSecond;
}

export interface PricingLookupParams {
  modality: UsageModality;
  model: string;
  parameters?: Record<string, unknown>;
  provider: string;
}

type TextPricingItem = ModelPricingItem & {
  inputCreditsPerMillionTokens: number;
  outputCreditsPerMillionTokens: number;
};

type FixedPricingItem = ModelPricingItem & {
  fixedCreditsPerUnit: number;
};

export class ModelPricingService {
  private readonly db: LobeChatDatabase;

  constructor(db: LobeChatDatabase) {
    this.db = db;
  }

  async findActivePricing(params: PricingLookupParams): Promise<ModelPricingItem> {
    const rows = await this.db
      .select()
      .from(modelPricing)
      .where(
        and(
          eq(modelPricing.provider, params.provider),
          eq(modelPricing.model, params.model),
          eq(modelPricing.modality, params.modality),
          eq(modelPricing.status, 'active'),
          lte(modelPricing.effectiveAt, new Date()),
        ),
      )
      .orderBy(desc(modelPricing.effectiveAt), desc(modelPricing.createdAt));

    const matched = rows.find((row) => matchesParameterRules(row.parameterRules, params.parameters));
    if (!matched) throw new PricingNotFoundError({ ...params });

    return matched;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const matchesParameterRules = (
  rules: Record<string, unknown> | null | undefined,
  parameters: Record<string, unknown> = {},
) => {
  if (!isRecord(rules) || Object.keys(rules).length === 0) return true;

  return Object.entries(rules).every(([key, expected]) => {
    if (key === 'unit') return true;

    const actual = parameters[key];
    if (Array.isArray(expected)) return expected.includes(actual);

    return actual === expected;
  });
};

export async function getTextPricing(
  params: Omit<PricingLookupParams, 'modality'>,
): Promise<TextPricingItem> {
  const pricing = await getModelPricing({ ...params, modality: 'text' });
  if (
    typeof pricing.inputCreditsPerMillionTokens !== 'number' ||
    typeof pricing.outputCreditsPerMillionTokens !== 'number'
  ) {
    throw new PricingNotFoundError({ ...params, modality: 'text', reason: 'missing_text_rates' });
  }

  return pricing as TextPricingItem;
}

export async function getImagePricing(
  params: Omit<PricingLookupParams, 'modality'>,
): Promise<FixedPricingItem> {
  const pricing = await getModelPricing({ ...params, modality: 'image' });
  if (typeof pricing.fixedCreditsPerUnit !== 'number') {
    throw new PricingNotFoundError({ ...params, modality: 'image', reason: 'missing_fixed_rate' });
  }

  return pricing as FixedPricingItem;
}

export async function getVideoPricing(
  params: Omit<PricingLookupParams, 'modality'>,
): Promise<FixedPricingItem> {
  const pricing = await getModelPricing({ ...params, modality: 'video' });
  if (typeof pricing.fixedCreditsPerUnit !== 'number') {
    throw new PricingNotFoundError({ ...params, modality: 'video', reason: 'missing_fixed_rate' });
  }

  return pricing as FixedPricingItem;
}

async function getModelPricing(params: PricingLookupParams) {
  const db = await getServerDB();
  return new ModelPricingService(db).findActivePricing(params);
}

export function getInitialModelPricingRows(): NewModelPricing[] {
  return [
    {
      inputCreditsPerMillionTokens: 2_000_000,
      modality: 'text',
      model: 'gpt-4.1',
      outputCreditsPerMillionTokens: 8_000_000,
      priceKey: 'text:gpt-4.1',
      provider: 'openai',
      status: 'active',
    },
    {
      inputCreditsPerMillionTokens: 3_000_000,
      modality: 'text',
      model: 'claude-3-7-sonnet',
      outputCreditsPerMillionTokens: 15_000_000,
      priceKey: 'text:claude-3-7-sonnet',
      provider: 'anthropic',
      status: 'active',
    },
    {
      inputCreditsPerMillionTokens: 280_000,
      modality: 'text',
      model: 'deepseek-v3',
      outputCreditsPerMillionTokens: 1_100_000,
      priceKey: 'text:deepseek-v3',
      provider: 'deepseek',
      status: 'active',
    },
    {
      fixedCreditsPerUnit: 40_000,
      modality: 'image',
      model: 'dall-e-3',
      parameterRules: { quality: 'standard', size: '1024x1024' },
      priceKey: 'image:dall-e-3:standard:1024x1024',
      provider: 'openai',
      status: 'active',
      unit: 'image',
    },
    {
      fixedCreditsPerUnit: 80_000,
      modality: 'image',
      model: 'dall-e-3',
      parameterRules: { quality: 'standard', size: '1792x1024' },
      priceKey: 'image:dall-e-3:standard:1792x1024',
      provider: 'openai',
      status: 'active',
      unit: 'image',
    },
    {
      fixedCreditsPerUnit: 20_000,
      modality: 'video',
      model: 'default-video',
      parameterRules: { unit: 'second' },
      priceKey: 'video:default-video:second',
      provider: 'lobehub',
      status: 'active',
      unit: 'second',
    },
  ];
}
