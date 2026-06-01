import { z } from 'zod';

import { CreditsService } from '@/business/server/billing/credits';
import { estimateTextCreditsForRequest, getTextPricing } from '@/business/server/billing/pricing';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware/serverDatabase';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const spendProcedure = authedProcedure.use(serverDatabase).use((opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: {
      creditsService: new CreditsService(ctx.serverDB, ctx.userId),
    },
  });
});

export const spendRouter = router({
  estimateText: spendProcedure
    .input(
      z.object({
        inputTokens: z.number().int().nonnegative(),
        maxOutputTokens: z.number().int().positive().optional(),
        model: z.string().min(1),
        provider: z.string().min(1),
      }),
    )
    .query(async ({ input }) => {
      const pricing = await getTextPricing({ model: input.model, provider: input.provider });

      return {
        estimatedCredits: estimateTextCreditsForRequest({
          inputCreditsPerMillionTokens: pricing.inputCreditsPerMillionTokens,
          maxOutputTokens: input.maxOutputTokens,
          outputCreditsPerMillionTokens: pricing.outputCreditsPerMillionTokens,
          promptTokensEstimate: input.inputTokens,
        }),
      };
    }),

  getBalance: spendProcedure.query(({ ctx }) => ctx.creditsService.getBalance()),

  listGrantPackages: spendProcedure.query(({ ctx }) => ctx.creditsService.listGrantPackages()),

  listUsageRecords: spendProcedure
    .input(
      z
        .object({
          cursor: z.string().optional(),
          pageSize: z.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
        })
        .optional(),
    )
    .query(({ ctx, input }) =>
      ctx.creditsService.listUsageRecords({
        cursor: input?.cursor,
        pageSize: input?.pageSize ?? DEFAULT_PAGE_SIZE,
      }),
    ),
});
