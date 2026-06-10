import { TRPCError } from '@trpc/server';
import { and, desc, eq, lte } from 'drizzle-orm';
import { z } from 'zod';

import type { ProviderConfigScope } from '@/business/server/globalProviderScope/constants';
import { isGlobalProviderScope } from '@/business/server/globalProviderScope/constants';
import {
  assertGlobalProviderScopeReadable,
  assertGlobalProviderScopeWritable,
} from '@/business/server/globalProviderScope/permissions';
import { modelPricing } from '@/database/schemas';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';

const providerConfigScopeSchema = z.enum(['user', 'global']).optional();
const pricingModalitySchema = z.enum(['text', 'image', 'video']);
const creditAmountSchema = z.number().int().positive().optional();
const MIN_TOKEN_CREDITS_PER_MILLION = 1_000;
const numericAmountSchema = z.number().positive().optional();

const listModelPricingSchema = z.object({
  modality: pricingModalitySchema.optional(),
  model: z.string(),
  provider: z.string(),
  scope: providerConfigScopeSchema,
});

const createModelPricingVersionSchema = listModelPricingSchema
  .extend({
    currency: z.literal('CNY').default('CNY'),
    effectiveAt: z.coerce.date().optional(),
    fixedCreditsPerUnit: creditAmountSchema,
    inputCreditsPerMillionTokens: creditAmountSchema,
    modality: pricingModalitySchema.default('text'),
    outputCreditsPerMillionTokens: creditAmountSchema,
    parameterRules: z.record(z.string(), z.unknown()).optional(),
    priceKey: z.string().optional(),
    providerCost: numericAmountSchema,
    reason: z.string().min(1),
    sellRate: numericAmountSchema,
    unit: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    const hasInputRate = typeof value.inputCreditsPerMillionTokens === 'number';
    const hasOutputRate = typeof value.outputCreditsPerMillionTokens === 'number';
    const hasTokenRates = hasInputRate && hasOutputRate;
    const hasPartialTokenRates = hasInputRate !== hasOutputRate;
    const hasFixedRate = typeof value.fixedCreditsPerUnit === 'number';

    if (!hasTokenRates && !hasFixedRate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'MODEL_PRICING_PRICE_REQUIRED' });
      return;
    }

    if (hasTokenRates) {
      const tooSmall =
        value.inputCreditsPerMillionTokens! < MIN_TOKEN_CREDITS_PER_MILLION ||
        value.outputCreditsPerMillionTokens! < MIN_TOKEN_CREDITS_PER_MILLION;

      if (tooSmall) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'MODEL_PRICING_TOKEN_RATE_TOO_SMALL',
        });
      }
    }

    if (hasFixedRate && !value.unit) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'MODEL_PRICING_FIXED_UNIT_REQUIRED' });
    }

    if (value.modality === 'image') {
      if (
        hasPartialTokenRates ||
        (hasTokenRates && hasFixedRate) ||
        (!hasTokenRates && !hasFixedRate)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'MODEL_PRICING_IMAGE_PRICE_EXCLUSIVE',
        });
      }
      return;
    }

    if (value.modality === 'video' && hasFixedRate) return;

    if (!hasTokenRates || hasFixedRate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'MODEL_PRICING_TOKEN_RATES_REQUIRED' });
    }
  });

const retireModelPricingVersionSchema = z.object({
  id: z.string(),
  reason: z.string().min(1),
  scope: providerConfigScopeSchema,
});

const providerPricingProcedure = authedProcedure.use(serverDatabase);

const getPricingRuleKey = (rules: Record<string, unknown> | null) =>
  rules
    ? Object.keys(rules)
        .sort()
        .map((key) => `${key}:${JSON.stringify(rules[key])}`)
        .join('|')
    : '';

const getCurrentPricingRows = (rows: (typeof modelPricing.$inferSelect)[]) => {
  const rowsByCurrentShape = new Map<string, typeof modelPricing.$inferSelect>();

  for (const row of rows) {
    const key = `${row.modality}:${getPricingRuleKey(row.parameterRules)}`;
    if (!rowsByCurrentShape.has(key)) rowsByCurrentShape.set(key, row);
  }

  return [...rowsByCurrentShape.values()];
};

const buildPricingVersionConditions = (value: {
  modality: 'text' | 'image' | 'video';
  model: string;
  parameterRules?: Record<string, unknown>;
  provider: string;
}) => [
  eq(modelPricing.provider, value.provider),
  eq(modelPricing.model, value.model),
  eq(modelPricing.modality, value.modality),
  eq(modelPricing.status, 'active'),
  eq(modelPricing.parameterRules, value.parameterRules ?? {}),
];

const assertGlobalPricingScopeWritable = async (params: {
  scope?: ProviderConfigScope;
  serverDB: Parameters<typeof assertGlobalProviderScopeWritable>[0]['db'];
  userId: string;
}) => {
  if (!isGlobalProviderScope(params.scope)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'GLOBAL_PROVIDER_SCOPE_REQUIRED' });
  }

  await assertGlobalProviderScopeWritable({
    db: params.serverDB,
    selector: { scope: params.scope },
    userId: params.userId,
  });
};

export const providerPricingRouter = router({
  createModelPricingVersion: providerPricingProcedure
    .input(createModelPricingVersionSchema)
    .mutation(async ({ ctx, input }) => {
      await assertGlobalPricingScopeWritable({
        scope: input.scope,
        serverDB: ctx.serverDB,
        userId: ctx.userId,
      });

      const { reason, scope, ...value } = input;
      void reason;
      void scope;
      const now = Date.now();
      await ctx.serverDB
        .update(modelPricing)
        .set({ status: 'retired', updatedAt: new Date(now) })
        .where(and(...buildPricingVersionConditions(value)));

      const [created] = await ctx.serverDB
        .insert(modelPricing)
        .values({
          ...value,
          effectiveAt: value.effectiveAt ?? new Date(now),
          priceKey: value.priceKey ?? `${value.modality}:${value.provider}:${value.model}:${now}`,
          status: 'active',
        })
        .returning();

      if (!created)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'MODEL_PRICING_CREATE_FAILED',
        });

      return { data: created, message: 'Model pricing version created', success: true };
    }),

  listModelPricing: providerPricingProcedure
    .input(listModelPricingSchema)
    .query(async ({ ctx, input }) => {
      const isGlobalScope = isGlobalProviderScope(input.scope);
      if (isGlobalProviderScope(input.scope)) {
        await assertGlobalProviderScopeReadable({
          db: ctx.serverDB,
          selector: input,
          userId: ctx.userId,
        });
      }

      const now = new Date();

      const conditions = [
        eq(modelPricing.provider, input.provider),
        eq(modelPricing.model, input.model),
      ];

      if (input.modality) conditions.push(eq(modelPricing.modality, input.modality));
      if (!isGlobalScope) {
        conditions.push(eq(modelPricing.status, 'active'));
        conditions.push(lte(modelPricing.effectiveAt, now));
      }

      const rows = await ctx.serverDB
        .select()
        .from(modelPricing)
        .where(and(...conditions))
        .orderBy(desc(modelPricing.effectiveAt), desc(modelPricing.createdAt));

      return {
        data: isGlobalScope
          ? rows
          : getCurrentPricingRows(
              rows.filter((row) => row.status === 'active' && row.effectiveAt <= now),
            ),
        success: true,
      };
    }),

  retireModelPricingVersion: providerPricingProcedure
    .input(retireModelPricingVersionSchema)
    .mutation(async ({ ctx, input }) => {
      await assertGlobalPricingScopeWritable({
        scope: input.scope,
        serverDB: ctx.serverDB,
        userId: ctx.userId,
      });

      const { reason } = input;
      void reason;
      const [updated] = await ctx.serverDB
        .update(modelPricing)
        .set({ status: 'retired', updatedAt: new Date() })
        .where(eq(modelPricing.id, input.id))
        .returning();

      if (!updated) throw new TRPCError({ code: 'NOT_FOUND', message: 'MODEL_PRICING_NOT_FOUND' });

      return { data: updated, message: 'Model pricing version retired', success: true };
    }),
});

export type ProviderPricingRouter = typeof providerPricingRouter;
