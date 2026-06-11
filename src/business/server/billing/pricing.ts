import { and, asc, desc, eq, lte } from 'drizzle-orm';

import { GLOBAL_PROVIDER_CONFIG_USER_ID } from '@/business/server/globalProviderScope/constants';
import { getServerDB } from '@/database/core/db-adaptor';
import type { ModelPricingItem, NewModelPricing, UsageModality } from '@/database/schemas';
import { aiModels, aiProviders, modelPricing } from '@/database/schemas';
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

interface ImageTokenCreditsParams {
  cachedInputTokens?: number;
  inputCreditsPerMillionTokens: number;
  inputTokens: number;
  outputCreditsPerMillionTokens: number;
  outputTokens: number;
}

const ESTIMATED_CHARS_PER_TOKEN = 4;
const ESTIMATED_IMAGE_OUTPUT_TOKENS = 1000;
const ESTIMATED_VIDEO_OUTPUT_TOKENS_PER_SECOND = 1000;

export function calculateImageTokenCredits(params: ImageTokenCreditsParams) {
  return calculateTextCredits({
    inputCreditsPerMillionTokens: params.inputCreditsPerMillionTokens,
    inputTokens: Math.max(0, params.inputTokens - (params.cachedInputTokens ?? 0)),
    outputCreditsPerMillionTokens: params.outputCreditsPerMillionTokens,
    outputTokens: params.outputTokens,
  });
}

export function estimateImageTokenCreditsForRequest(params: {
  imageNum: number;
  inputCreditsPerMillionTokens: number;
  outputCreditsPerMillionTokens: number;
  prompt?: string;
}) {
  const promptTokensEstimate = Math.ceil((params.prompt?.length ?? 0) / ESTIMATED_CHARS_PER_TOKEN);

  return calculateImageTokenCredits({
    inputCreditsPerMillionTokens: params.inputCreditsPerMillionTokens,
    inputTokens: promptTokensEstimate,
    outputCreditsPerMillionTokens: params.outputCreditsPerMillionTokens,
    outputTokens: params.imageNum * ESTIMATED_IMAGE_OUTPUT_TOKENS,
  });
}

export function calculateVideoCredits(params: {
  durationSeconds: number;
  fixedCreditsPerSecond: number;
}) {
  return params.durationSeconds * params.fixedCreditsPerSecond;
}

export function estimateVideoTokenCreditsForRequest(params: {
  durationSeconds: number;
  inputCreditsPerMillionTokens: number;
  outputCreditsPerMillionTokens: number;
  prompt?: string;
}) {
  const promptTokensEstimate = Math.ceil((params.prompt?.length ?? 0) / ESTIMATED_CHARS_PER_TOKEN);

  return calculateTextCredits({
    inputCreditsPerMillionTokens: params.inputCreditsPerMillionTokens,
    inputTokens: promptTokensEstimate,
    outputCreditsPerMillionTokens: params.outputCreditsPerMillionTokens,
    outputTokens: params.durationSeconds * ESTIMATED_VIDEO_OUTPUT_TOKENS_PER_SECOND,
  });
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

type ImagePricingItem = FixedPricingItem | TextPricingItem;
type VideoPricingItem = FixedPricingItem | TextPricingItem;

export interface PublicTextModelPricingRow {
  contextWindowTokens: number;
  displayName: string;
  id: string;
  inputCreditsPerMillionTokens: number;
  model: string;
  outputCreditsPerMillionTokens: number;
  provider: string;
}

export const listPublicTextModelPricingRows = async (
  db: LobeChatDatabase,
): Promise<PublicTextModelPricingRow[]> => {
  const now = new Date();
  const providers = await db
    .select({ enabled: aiProviders.enabled, id: aiProviders.id })
    .from(aiProviders)
    .where(eq(aiProviders.userId, GLOBAL_PROVIDER_CONFIG_USER_ID))
    .orderBy(asc(aiProviders.sort), asc(aiProviders.id));
  const enabledProviderIds = new Set(
    providers.filter((provider) => provider.enabled === true).map((provider) => provider.id),
  );

  if (enabledProviderIds.size === 0) return [];

  const [models, prices] = await Promise.all([
    db
      .select()
      .from(aiModels)
      .where(
        and(
          eq(aiModels.userId, GLOBAL_PROVIDER_CONFIG_USER_ID),
          eq(aiModels.enabled, true),
          eq(aiModels.type, 'chat'),
        ),
      )
      .orderBy(asc(aiModels.sort), desc(aiModels.updatedAt)),
    db
      .select()
      .from(modelPricing)
      .where(
        and(
          eq(modelPricing.modality, 'text'),
          eq(modelPricing.status, 'active'),
          lte(modelPricing.effectiveAt, now),
        ),
      )
      .orderBy(desc(modelPricing.effectiveAt), desc(modelPricing.createdAt)),
  ]);

  const latestPriceByModel = prices.reduce<Map<string, ModelPricingItem>>((map, price) => {
    const key = `${price.provider}:${price.model}`;
    if (!map.has(key)) map.set(key, price);

    return map;
  }, new Map());

  return models.flatMap((model) => {
    if (!enabledProviderIds.has(model.providerId)) return [];

    const price = latestPriceByModel.get(`${model.providerId}:${model.id}`);
    if (
      !price ||
      typeof price.inputCreditsPerMillionTokens !== 'number' ||
      typeof price.outputCreditsPerMillionTokens !== 'number'
    ) {
      return [];
    }

    return [
      {
        contextWindowTokens: model.contextWindowTokens ?? 0,
        displayName: model.displayName || model.id,
        id: `text:${model.id}`,
        inputCreditsPerMillionTokens: price.inputCreditsPerMillionTokens,
        model: model.id,
        outputCreditsPerMillionTokens: price.outputCreditsPerMillionTokens,
        provider: model.providerId,
      },
    ];
  });
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

    const matched = rows.find((row) =>
      matchesParameterRules(row.parameterRules, params.parameters),
    );
    if (matched) return matched;

    if (params.modality === 'video') {
      const fallbackRows = await this.db
        .select()
        .from(modelPricing)
        .where(
          and(
            eq(modelPricing.provider, params.provider),
            eq(modelPricing.model, params.model),
            eq(modelPricing.modality, 'text'),
            eq(modelPricing.status, 'active'),
            lte(modelPricing.effectiveAt, new Date()),
          ),
        )
        .orderBy(desc(modelPricing.effectiveAt), desc(modelPricing.createdAt));

      const fallback = fallbackRows.find(
        (row) =>
          typeof row.inputCreditsPerMillionTokens === 'number' &&
          typeof row.outputCreditsPerMillionTokens === 'number' &&
          matchesParameterRules(row.parameterRules, params.parameters),
      );

      if (fallback) return fallback;
    }

    throw new PricingNotFoundError({ ...params });
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
): Promise<ImagePricingItem> {
  const pricing = await getModelPricing({ ...params, modality: 'image' });
  if (
    typeof pricing.fixedCreditsPerUnit !== 'number' &&
    (typeof pricing.inputCreditsPerMillionTokens !== 'number' ||
      typeof pricing.outputCreditsPerMillionTokens !== 'number')
  ) {
    throw new PricingNotFoundError({ ...params, modality: 'image', reason: 'missing_image_rates' });
  }

  return pricing as ImagePricingItem;
}

export async function getVideoPricing(
  params: Omit<PricingLookupParams, 'modality'>,
): Promise<VideoPricingItem> {
  const pricing = await getModelPricing({ ...params, modality: 'video' });
  if (
    typeof pricing.fixedCreditsPerUnit !== 'number' &&
    (typeof pricing.inputCreditsPerMillionTokens !== 'number' ||
      typeof pricing.outputCreditsPerMillionTokens !== 'number')
  ) {
    throw new PricingNotFoundError({ ...params, modality: 'video', reason: 'missing_video_rates' });
  }

  return pricing as VideoPricingItem;
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
