import { and, desc, eq, lte } from 'drizzle-orm';

import { getServerDB } from '@/database/core/db-adaptor';
import type { ModelPricingItem, NewModelPricing, UsageModality } from '@/database/schemas';
import { modelPricing } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';

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

export interface PublicTextModelPricingRow {
  contextWindowTokens: number;
  displayName: string;
  id: string;
  inputCreditsPerMillionTokens: number;
  model: string;
  outputCreditsPerMillionTokens: number;
  provider: string;
}

const PUBLIC_TEXT_MODEL_PRICING_ROWS = [
  {
    contextWindowTokens: 1_000_000,
    displayName: 'DeepSeek V4 Pro',
    inputCreditsPerMillionTokens: 435_000,
    model: 'deepseek-v4-pro',
    outputCreditsPerMillionTokens: 870_000,
    provider: 'deepseek',
  },
  {
    contextWindowTokens: 1_000_000,
    displayName: 'DeepSeek V4 Flash',
    inputCreditsPerMillionTokens: 140_000,
    model: 'deepseek-v4-flash',
    outputCreditsPerMillionTokens: 280_000,
    provider: 'deepseek',
  },
  {
    contextWindowTokens: 1_000_000,
    displayName: 'Claude Sonnet 4.6',
    inputCreditsPerMillionTokens: 3_000_000,
    model: 'claude-sonnet-4.6',
    outputCreditsPerMillionTokens: 15_000_000,
    provider: 'anthropic',
  },
  {
    contextWindowTokens: 1_000_000,
    displayName: 'Claude Opus 4.8',
    inputCreditsPerMillionTokens: 5_000_000,
    model: 'claude-opus-4.8',
    outputCreditsPerMillionTokens: 25_000_000,
    provider: 'anthropic',
  },
  {
    contextWindowTokens: 1_000_000,
    displayName: 'Claude Opus 4.7',
    inputCreditsPerMillionTokens: 5_000_000,
    model: 'claude-opus-4.7',
    outputCreditsPerMillionTokens: 25_000_000,
    provider: 'anthropic',
  },
  {
    contextWindowTokens: 200_000,
    displayName: 'Claude Haiku 4.5',
    inputCreditsPerMillionTokens: 1_000_000,
    model: 'claude-haiku-4.5',
    outputCreditsPerMillionTokens: 5_000_000,
    provider: 'anthropic',
  },
  {
    contextWindowTokens: 1_000_000,
    displayName: 'Gemini 3.5 Flash',
    inputCreditsPerMillionTokens: 1_500_000,
    model: 'gemini-3.5-flash',
    outputCreditsPerMillionTokens: 9_000_000,
    provider: 'google',
  },
  {
    contextWindowTokens: 1_000_000,
    displayName: 'Gemini 3.1 Pro Preview',
    inputCreditsPerMillionTokens: 2_000_000,
    model: 'gemini-3.1-pro-preview',
    outputCreditsPerMillionTokens: 12_000_000,
    provider: 'google',
  },
  {
    contextWindowTokens: 1_000_000,
    displayName: 'Gemini 3.1 Flash-Lite',
    inputCreditsPerMillionTokens: 250_000,
    model: 'gemini-3.1-flash-lite',
    outputCreditsPerMillionTokens: 1_500_000,
    provider: 'google',
  },
  {
    contextWindowTokens: 163_000,
    displayName: 'Nano Banana 2',
    inputCreditsPerMillionTokens: 500_000,
    model: 'nano-banana-2',
    outputCreditsPerMillionTokens: 3_000_000,
    provider: 'google',
  },
  {
    contextWindowTokens: 163_000,
    displayName: 'Nano Banana Pro',
    inputCreditsPerMillionTokens: 2_000_000,
    model: 'nano-banana-pro',
    outputCreditsPerMillionTokens: 12_000_000,
    provider: 'google',
  },
  {
    contextWindowTokens: 1_000_000,
    displayName: 'GPT-5.5',
    inputCreditsPerMillionTokens: 5_000_000,
    model: 'gpt-5.5',
    outputCreditsPerMillionTokens: 30_000_000,
    provider: 'openai',
  },
  {
    contextWindowTokens: 1_000_000,
    displayName: 'GPT-5.5 Pro',
    inputCreditsPerMillionTokens: 30_000_000,
    model: 'gpt-5.5-pro',
    outputCreditsPerMillionTokens: 180_000_000,
    provider: 'openai',
  },
  {
    contextWindowTokens: 1_000_000,
    displayName: 'GPT-5.4',
    inputCreditsPerMillionTokens: 2_500_000,
    model: 'gpt-5.4',
    outputCreditsPerMillionTokens: 15_000_000,
    provider: 'openai',
  },
  {
    contextWindowTokens: 1_000_000,
    displayName: 'GPT-5.4 Pro',
    inputCreditsPerMillionTokens: 30_000_000,
    model: 'gpt-5.4-pro',
    outputCreditsPerMillionTokens: 180_000_000,
    provider: 'openai',
  },
  {
    contextWindowTokens: 400_000,
    displayName: 'GPT-5.4 mini',
    inputCreditsPerMillionTokens: 750_000,
    model: 'gpt-5.4-mini',
    outputCreditsPerMillionTokens: 4_500_000,
    provider: 'openai',
  },
  {
    contextWindowTokens: 400_000,
    displayName: 'GPT-5.4 nano',
    inputCreditsPerMillionTokens: 200_000,
    model: 'gpt-5.4-nano',
    outputCreditsPerMillionTokens: 1_250_000,
    provider: 'openai',
  },
  {
    contextWindowTokens: 400_000,
    displayName: 'GPT-5 mini',
    inputCreditsPerMillionTokens: 250_000,
    model: 'gpt-5-mini',
    outputCreditsPerMillionTokens: 2_000_000,
    provider: 'openai',
  },
  {
    contextWindowTokens: 1_000_000,
    displayName: 'Grok 4.3',
    inputCreditsPerMillionTokens: 1_250_000,
    model: 'grok-4.3',
    outputCreditsPerMillionTokens: 2_500_000,
    provider: 'xai',
  },
  {
    contextWindowTokens: 2_000_000,
    displayName: 'Grok 4.20 Beta',
    inputCreditsPerMillionTokens: 2_000_000,
    model: 'grok-4.20-beta',
    outputCreditsPerMillionTokens: 6_000_000,
    provider: 'xai',
  },
  {
    contextWindowTokens: 2_000_000,
    displayName: 'Grok 4.20 Beta (Non-Reasoning)',
    inputCreditsPerMillionTokens: 2_000_000,
    model: 'grok-4.20-beta-non-reasoning',
    outputCreditsPerMillionTokens: 6_000_000,
    provider: 'xai',
  },
  {
    contextWindowTokens: 262_000,
    displayName: 'Kimi K2.6',
    inputCreditsPerMillionTokens: 950_000,
    model: 'kimi-k2.6',
    outputCreditsPerMillionTokens: 4_000_000,
    provider: 'moonshot',
  },
  {
    contextWindowTokens: 262_000,
    displayName: 'Kimi K2.5',
    inputCreditsPerMillionTokens: 600_000,
    model: 'kimi-k2.5',
    outputCreditsPerMillionTokens: 3_000_000,
    provider: 'moonshot',
  },
  {
    contextWindowTokens: 512_000,
    displayName: 'MiniMax M3',
    inputCreditsPerMillionTokens: 600_000,
    model: 'minimax-m3',
    outputCreditsPerMillionTokens: 2_400_000,
    provider: 'minimax',
  },
  {
    contextWindowTokens: 204_000,
    displayName: 'MiniMax M2.7',
    inputCreditsPerMillionTokens: 300_000,
    model: 'minimax-m2.7',
    outputCreditsPerMillionTokens: 1_200_000,
    provider: 'minimax',
  },
  {
    contextWindowTokens: 204_000,
    displayName: 'MiniMax M2.7 Highspeed',
    inputCreditsPerMillionTokens: 600_000,
    model: 'minimax-m2.7-highspeed',
    outputCreditsPerMillionTokens: 2_400_000,
    provider: 'minimax',
  },
  {
    contextWindowTokens: 1_000_000,
    displayName: 'Qwen3.7 Max',
    inputCreditsPerMillionTokens: 2_500_000,
    model: 'qwen3.7-max',
    outputCreditsPerMillionTokens: 7_500_000,
    provider: 'qwen',
  },
  {
    contextWindowTokens: 1_000_000,
    displayName: 'Qwen3.7 Plus',
    inputCreditsPerMillionTokens: 400_000,
    model: 'qwen3.7-plus',
    outputCreditsPerMillionTokens: 1_600_000,
    provider: 'qwen',
  },
  {
    contextWindowTokens: 200_000,
    displayName: 'GLM-5.1',
    inputCreditsPerMillionTokens: 1_400_000,
    model: 'glm-5.1',
    outputCreditsPerMillionTokens: 4_400_000,
    provider: 'zhipu',
  },
  {
    contextWindowTokens: 200_000,
    displayName: 'GLM-5',
    inputCreditsPerMillionTokens: 1_000_000,
    model: 'glm-5',
    outputCreditsPerMillionTokens: 3_200_000,
    provider: 'zhipu',
  },
  {
    contextWindowTokens: 1_000_000,
    displayName: 'MiMo-V2.5 Pro',
    inputCreditsPerMillionTokens: 435_000,
    model: 'mimo-v2.5-pro',
    outputCreditsPerMillionTokens: 870_000,
    provider: 'xiaomi',
  },
  {
    contextWindowTokens: 1_000_000,
    displayName: 'MiMo-V2.5',
    inputCreditsPerMillionTokens: 140_000,
    model: 'mimo-v2.5',
    outputCreditsPerMillionTokens: 280_000,
    provider: 'xiaomi',
  },
  {
    contextWindowTokens: 262_000,
    displayName: 'MiMo-V2 Flash',
    inputCreditsPerMillionTokens: 100_000,
    model: 'mimo-v2-flash',
    outputCreditsPerMillionTokens: 300_000,
    provider: 'xiaomi',
  },
] as const satisfies Omit<PublicTextModelPricingRow, 'id'>[];

export const listPublicTextModelPricingRows = (): PublicTextModelPricingRow[] =>
  PUBLIC_TEXT_MODEL_PRICING_ROWS.map((row) => ({
    ...row,
    id: `text:${row.model}`,
  }));

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

    const matched = rows.find((row) =>
      matchesParameterRules(row.parameterRules, params.parameters),
    );
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
