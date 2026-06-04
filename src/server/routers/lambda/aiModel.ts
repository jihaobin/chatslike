import { type AiProviderModelListItem } from 'model-bank';
import {
  AiModelTypeSchema,
  CreateAiModelSchema,
  ToggleAiModelEnableSchema,
  UpdateAiModelSchema,
} from 'model-bank';
import { z } from 'zod';

import {
  isGlobalProviderScope,
  ProviderConfigScope,
  type ProviderConfigScopeSelector,
} from '@/business/server/globalProviderScope/constants';
import {
  assertGlobalProviderScopeReadable,
  assertGlobalProviderScopeWritable,
  assertUserProviderSettingsWritable,
  getProviderConfigScopeUserId,
} from '@/business/server/globalProviderScope/permissions';
import { AiModelModel } from '@/database/models/aiModel';
import { UserModel } from '@/database/models/user';
import { AiInfraRepos } from '@/database/repositories/aiInfra';
import type { LobeChatDatabase } from '@/database/type';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import { getServerGlobalConfig } from '@/server/globalConfig';
import { KeyVaultsGateKeeper } from '@/server/modules/KeyVaultsEncrypt';
import { type ProviderConfig } from '@/types/user/settings';

const providerConfigScopeSchema = z.enum(['user', 'global']).optional();
const providerModelListItemSchema = z.custom<AiProviderModelListItem>(
  (value) => typeof value === 'object' && value !== null && 'id' in value,
);

const createAiModelModel = (params: {
  ctx: { serverDB: LobeChatDatabase; userId: string };
  scope?: ProviderConfigScope;
}) =>
  new AiModelModel(
    params.ctx.serverDB,
    getProviderConfigScopeUserId({ requestedScope: params.scope, userId: params.ctx.userId }),
  );

const createAiInfraRepos = (params: {
  aiProvider: Record<string, ProviderConfig>;
  ctx: { serverDB: LobeChatDatabase; userId: string };
  platformHostedModelsEnabled?: boolean;
  scope?: ProviderConfigScope;
}) =>
  new AiInfraRepos(
    params.ctx.serverDB,
    getProviderConfigScopeUserId({ requestedScope: params.scope, userId: params.ctx.userId }),
    params.aiProvider,
    { platformHostedModelsEnabled: params.platformHostedModelsEnabled ?? false },
  );

const shouldReadGlobalProviderScope = (params: {
  commercial: Awaited<ReturnType<typeof getServerGlobalConfig>>['commercial'];
  scope?: ProviderConfigScope;
}) => isGlobalProviderScope(params.scope) || params.commercial?.platformHostedModels.enabled === true;

const assertModelScopeWritable = async (params: {
  commercial: Awaited<ReturnType<typeof getServerGlobalConfig>>['commercial'];
  selector?: ProviderConfigScopeSelector;
  serverDB: LobeChatDatabase;
  userId: string;
}) => {
  if (isGlobalProviderScope(params.selector?.scope)) {
    await assertGlobalProviderScopeWritable({
      db: params.serverDB,
      selector: params.selector,
      userId: params.userId,
    });
    return;
  }

  assertUserProviderSettingsWritable(params.commercial);
};

const aiModelProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;

  const gateKeeper = await KeyVaultsGateKeeper.initWithEnvKey();
  const { aiProvider, commercial } = await getServerGlobalConfig();

  return opts.next({
    ctx: {
      aiInfraRepos: new AiInfraRepos(
        ctx.serverDB,
        ctx.userId,
        aiProvider as Record<string, ProviderConfig>,
        { platformHostedModelsEnabled: commercial?.platformHostedModels.enabled ?? false },
      ),
      aiProviderConfig: aiProvider as Record<string, ProviderConfig>,
      aiModelModel: new AiModelModel(ctx.serverDB, ctx.userId),
      commercial,
      gateKeeper,
      userModel: new UserModel(ctx.serverDB, ctx.userId),
    },
  });
});

export const aiModelRouter = router({
  batchToggleAiModels: aiModelProcedure
    .input(
      z.object({
        enabled: z.boolean(),
        id: z.string(),
        models: z.array(z.string()),
        scope: providerConfigScopeSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await assertModelScopeWritable({
        commercial: ctx.commercial,
        selector: input,
        serverDB: ctx.serverDB,
        userId: ctx.userId,
      });

      return createAiModelModel({ ctx, scope: input.scope }).batchToggleAiModels(
        input.id,
        input.models,
        input.enabled,
      );
    }),
  batchUpdateAiModels: aiModelProcedure
    .input(
      z.object({
        id: z.string(),
        // TODO: Complete validation schema
        models: z.array(providerModelListItemSchema),
        scope: providerConfigScopeSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await assertModelScopeWritable({
        commercial: ctx.commercial,
        selector: input,
        serverDB: ctx.serverDB,
        userId: ctx.userId,
      });

      return createAiModelModel({ ctx, scope: input.scope }).batchUpdateAiModels(
        input.id,
        input.models,
      );
    }),

  clearModelsByProvider: aiModelProcedure
    .input(z.object({ providerId: z.string(), scope: providerConfigScopeSchema }))
    .mutation(async ({ input, ctx }) => {
      await assertModelScopeWritable({
        commercial: ctx.commercial,
        selector: input,
        serverDB: ctx.serverDB,
        userId: ctx.userId,
      });

      return createAiModelModel({ ctx, scope: input.scope }).clearModelsByProvider(input.providerId);
    }),
  clearRemoteModels: aiModelProcedure
    .input(z.object({ providerId: z.string(), scope: providerConfigScopeSchema }))
    .mutation(async ({ input, ctx }) => {
      await assertModelScopeWritable({
        commercial: ctx.commercial,
        selector: input,
        serverDB: ctx.serverDB,
        userId: ctx.userId,
      });

      return createAiModelModel({ ctx, scope: input.scope }).clearRemoteModels(input.providerId);
    }),

  createAiModel: aiModelProcedure
    .input(CreateAiModelSchema.extend({ scope: providerConfigScopeSchema }))
    .mutation(async ({ input, ctx }) => {
      await assertModelScopeWritable({
        commercial: ctx.commercial,
        selector: input,
        serverDB: ctx.serverDB,
        userId: ctx.userId,
      });

      const { scope, ...value } = input;
      const data = await createAiModelModel({ ctx, scope }).create(value);

      return data?.id;
    }),

  getAiModelById: aiModelProcedure
    .input(z.object({ id: z.string(), scope: providerConfigScopeSchema }))

    .query(async ({ input, ctx }) => {
      if (isGlobalProviderScope(input.scope)) {
        await assertGlobalProviderScopeReadable({
          db: ctx.serverDB,
          selector: input,
          userId: ctx.userId,
        });
      }

      return createAiModelModel({ ctx, scope: input.scope }).findById(input.id);
    }),

  getAiProviderModelList: aiModelProcedure
    .input(
      z.object({
        enabled: z.boolean().optional(),
        id: z.string(),
        limit: z.number().int().min(1).max(200).optional(),
        offset: z.number().int().min(0).optional(),
        scope: providerConfigScopeSchema,
        type: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }): Promise<AiProviderModelListItem[]> => {
      if (isGlobalProviderScope(input.scope)) {
        await assertGlobalProviderScopeReadable({
          db: ctx.serverDB,
          selector: input,
          userId: ctx.userId,
        });
      }

      const aiInfraRepos = shouldReadGlobalProviderScope({ commercial: ctx.commercial, scope: input.scope })
        ? createAiInfraRepos({
            aiProvider: ctx.aiProviderConfig,
            ctx,
            platformHostedModelsEnabled: ctx.commercial?.platformHostedModels.enabled ?? false,
            scope: ProviderConfigScope.Global,
          })
        : ctx.aiInfraRepos;

      return aiInfraRepos.getAiProviderModelList(input.id, {
        enabled: input.enabled,
        limit: input.limit,
        offset: input.offset,
        type: input.type,
      });
    }),

  removeAiModel: aiModelProcedure
    .input(z.object({ id: z.string(), providerId: z.string(), scope: providerConfigScopeSchema }))
    .mutation(async ({ input, ctx }) => {
      await assertModelScopeWritable({
        commercial: ctx.commercial,
        selector: input,
        serverDB: ctx.serverDB,
        userId: ctx.userId,
      });

      return createAiModelModel({ ctx, scope: input.scope }).delete(input.id, input.providerId);
    }),

  toggleModelEnabled: aiModelProcedure
    .input(ToggleAiModelEnableSchema.extend({ scope: providerConfigScopeSchema }))
    .mutation(async ({ input, ctx }) => {
      await assertModelScopeWritable({
        commercial: ctx.commercial,
        selector: input,
        serverDB: ctx.serverDB,
        userId: ctx.userId,
      });

      const { scope, ...value } = input;
      return createAiModelModel({ ctx, scope }).toggleModelEnabled(value);
    }),

  updateAiModel: aiModelProcedure
    .input(
      z.object({
        id: z.string(),
        providerId: z.string(),
        scope: providerConfigScopeSchema,
        value: UpdateAiModelSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await assertModelScopeWritable({
        commercial: ctx.commercial,
        selector: input,
        serverDB: ctx.serverDB,
        userId: ctx.userId,
      });

      return createAiModelModel({ ctx, scope: input.scope }).update(
        input.id,
        input.providerId,
        input.value,
      );
    }),

  updateAiModelOrder: aiModelProcedure
    .input(
      z.object({
        providerId: z.string(),
        scope: providerConfigScopeSchema,
        sortMap: z.array(
          z.object({
            id: z.string(),
            sort: z.number(),
            type: AiModelTypeSchema.optional(),
          }),
        ),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await assertModelScopeWritable({
        commercial: ctx.commercial,
        selector: input,
        serverDB: ctx.serverDB,
        userId: ctx.userId,
      });

      return createAiModelModel({ ctx, scope: input.scope }).updateModelsOrder(
        input.providerId,
        input.sortMap,
      );
    }),
});

export type AiModelRouter = typeof aiModelRouter;
