import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { PlatformCatalogService } from '@/business/server/platformCatalog/service';
import { isSuperAdminRole } from '@/const/authRoles';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware/serverDatabase';

const usageModalitySchema = z.enum(['text', 'image', 'video']);

const nonEmptyReasonSchema = z.string().trim().min(1);

const listModelsSchema = z
  .object({
    enabled: z.boolean().optional(),
    modality: z.string().min(1).optional(),
    upstreamProvider: z.string().min(1).optional(),
  })
  .optional();

const listPricingSchema = z.object({
  modality: usageModalitySchema.optional(),
  model: z.string().min(1),
});

const updateProviderSchema = z.object({
  enabled: z.boolean(),
  reason: nonEmptyReasonSchema,
});

const updateModelSchema = z.object({
  abilities: z.record(z.string(), z.unknown()).optional(),
  contextWindowTokens: z.number().int().nonnegative().nullable().optional(),
  description: z.string().nullable().optional(),
  displayName: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
  model: z.string().min(1),
  reason: nonEmptyReasonSchema,
  settings: z.record(z.string(), z.unknown()).optional(),
  sort: z.number().int().nullable().optional(),
  upstreamDisplayName: z.string().nullable().optional(),
  upstreamProvider: z.string().nullable().optional(),
});

const toggleModelSchema = z.object({
  enabled: z.boolean(),
  model: z.string().min(1),
  reason: nonEmptyReasonSchema,
});

const createPricingSchema = z.object({
  currency: z.string().min(1).optional(),
  effectiveAt: z.date().optional(),
  fixedCreditsPerUnit: z.number().int().nonnegative().optional(),
  inputCreditsPerMillionTokens: z.number().int().nonnegative().optional(),
  modality: usageModalitySchema,
  model: z.string().min(1),
  outputCreditsPerMillionTokens: z.number().int().nonnegative().optional(),
  parameterRules: z.record(z.string(), z.unknown()).optional(),
  priceKey: z.string().min(1).optional(),
  providerCost: z.number().nonnegative().optional(),
  reason: nonEmptyReasonSchema,
  sellRate: z.number().nonnegative().optional(),
  unit: z.string().min(1).optional(),
});

const retirePricingSchema = z.object({
  id: z.string().min(1),
  reason: nonEmptyReasonSchema,
});

const adminPlatformCatalogProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;
  const user = await ctx.serverDB.query.users.findFirst({
    columns: { id: true, role: true },
    where: (table, { eq }) => eq(table.id, ctx.userId),
  });

  if (!isSuperAdminRole(user?.role)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Platform catalog access is restricted to super administrators',
    });
  }

  return opts.next({
    ctx: {
      platformCatalogService: new PlatformCatalogService(ctx.serverDB, ctx.userId),
    },
  });
});

export const platformCatalogRouter = router({
  createModelPricingVersion: adminPlatformCatalogProcedure
    .input(createPricingSchema)
    .mutation(({ ctx, input }) => ctx.platformCatalogService.createModelPricingVersion(input)),

  getNewApiProviderStatus: adminPlatformCatalogProcedure.query(({ ctx }) =>
    ctx.platformCatalogService.getNewApiProviderStatus(),
  ),

  listModelPricing: adminPlatformCatalogProcedure
    .input(listPricingSchema)
    .query(({ ctx, input }) => ctx.platformCatalogService.listModelPricing(input)),

  listPlatformModels: adminPlatformCatalogProcedure
    .input(listModelsSchema)
    .query(({ ctx, input }) => ctx.platformCatalogService.listPlatformModels(input)),

  retireModelPricingVersion: adminPlatformCatalogProcedure
    .input(retirePricingSchema)
    .mutation(({ ctx, input }) => ctx.platformCatalogService.retireModelPricingVersion(input)),

  togglePlatformModelEnabled: adminPlatformCatalogProcedure
    .input(toggleModelSchema)
    .mutation(({ ctx, input }) => ctx.platformCatalogService.togglePlatformModelEnabled(input)),

  updateNewApiProviderStatus: adminPlatformCatalogProcedure
    .input(updateProviderSchema)
    .mutation(({ ctx, input }) => ctx.platformCatalogService.updateNewApiProviderStatus(input)),

  updatePlatformModel: adminPlatformCatalogProcedure
    .input(updateModelSchema)
    .mutation(({ ctx, input }) => ctx.platformCatalogService.updatePlatformModel(input)),
});
