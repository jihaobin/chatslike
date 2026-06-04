import { TRPCError } from '@trpc/server';
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
import { AiProviderModel } from '@/database/models/aiProvider';
import { UserModel } from '@/database/models/user';
import { AiInfraRepos } from '@/database/repositories/aiInfra';
import type { LobeChatDatabase } from '@/database/type';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import { getServerGlobalConfig } from '@/server/globalConfig';
import { KeyVaultsGateKeeper } from '@/server/modules/KeyVaultsEncrypt';
import { initModelRuntimeFromDB } from '@/server/modules/ModelRuntime';
import { type AiProviderDetailItem, type AiProviderRuntimeState } from '@/types/aiProvider';
import {
  CreateAiProviderSchema,
  UpdateAiProviderConfigSchema,
  UpdateAiProviderSchema,
} from '@/types/aiProvider';
import { type ProviderConfig } from '@/types/user/settings';

const providerConfigScopeSchema = z.enum(['user', 'global']).optional();
const scopedCreateAiProviderSchema = CreateAiProviderSchema.extend({
  scope: providerConfigScopeSchema,
});
const providerScopeInputSchema = z.object({ scope: providerConfigScopeSchema }).optional();
const providerIdInputSchema = z.object({ id: z.string(), scope: providerConfigScopeSchema });

const getErrorCode = (error: unknown): string | undefined => {
  if (!error || typeof error !== 'object') return;

  const record = error as Record<string, unknown>;
  if (typeof record.code === 'string') return record.code;

  return getErrorCode(record.cause);
};

const getConnectivityErrorMessage = (error: unknown) => {
  if (typeof error === 'string') return error;
  if (!error || typeof error !== 'object') return String(error);

  const record = error as Record<string, unknown>;
  if (typeof record.errorType === 'string') return record.errorType;
  if (typeof record.type === 'string') return record.type;
  if (typeof record.message === 'string') return record.message;

  return JSON.stringify(error);
};

const aiProviderProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;

  const { aiProvider, commercial } = await getServerGlobalConfig();

  const gateKeeper = await KeyVaultsGateKeeper.initWithEnvKey();
  return opts.next({
    ctx: {
      aiInfraRepos: new AiInfraRepos(
        ctx.serverDB,
        ctx.userId,
        aiProvider as Record<string, ProviderConfig>,
        { platformHostedModelsEnabled: commercial?.platformHostedModels.enabled ?? false },
      ),
      aiProviderModel: new AiProviderModel(ctx.serverDB, ctx.userId),
      aiProviderConfig: aiProvider as Record<string, ProviderConfig>,
      commercial,
      gateKeeper,
      userModel: new UserModel(ctx.serverDB, ctx.userId),
    },
  });
});

const createAiProviderRepos = (params: {
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
}) =>
  isGlobalProviderScope(params.scope) || params.commercial?.platformHostedModels.enabled === true;

const sanitizeProviderDetailForPlatformUser = (
  detail: AiProviderDetailItem | undefined,
  shouldSanitize: boolean,
): AiProviderDetailItem | undefined => {
  if (!detail || !shouldSanitize) {
    return detail;
  }

  const { keyVaults, ...rest } = detail;
  void keyVaults;
  return rest;
};

const sanitizeRuntimeStateForPlatformUser = (
  runtimeState: AiProviderRuntimeState,
  shouldSanitize: boolean,
): AiProviderRuntimeState => {
  if (!shouldSanitize) return runtimeState;

  return {
    ...runtimeState,
    runtimeConfig: Object.fromEntries(
      Object.entries(runtimeState.runtimeConfig).map(([providerId, config]) => [
        providerId,
        { ...config, keyVaults: {} },
      ]),
    ),
  };
};

const createAiProviderModel = (params: {
  ctx: { serverDB: LobeChatDatabase; userId: string };
  scope?: ProviderConfigScope;
}) =>
  new AiProviderModel(
    params.ctx.serverDB,
    getProviderConfigScopeUserId({ requestedScope: params.scope, userId: params.ctx.userId }),
  );

const assertProviderScopeWritable = async (params: {
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

export const aiProviderRouter = router({
  checkProviderConnectivity: aiProviderProcedure
    .input(
      z.object({
        id: z.string(),
        model: z.string().optional(),
        scope: providerConfigScopeSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (isGlobalProviderScope(input.scope)) {
        await assertGlobalProviderScopeWritable({
          db: ctx.serverDB,
          selector: input,
          userId: ctx.userId,
        });
      }

      const aiInfraRepos = isGlobalProviderScope(input.scope)
        ? createAiProviderRepos({
            aiProvider: ctx.aiProviderConfig,
            ctx,
            platformHostedModelsEnabled: ctx.commercial?.platformHostedModels.enabled ?? false,
            scope: ProviderConfigScope.Global,
          })
        : ctx.aiInfraRepos;

      // Get the provider detail to find checkModel
      const detail = await aiInfraRepos.getAiProviderDetail(
        input.id,
        KeyVaultsGateKeeper.getUserKeyVaults,
      );

      const model = input.model || detail?.checkModel;
      if (!model) {
        return { error: 'No check model configured. Use --model to specify one.', ok: false };
      }

      try {
        const modelRuntime = await initModelRuntimeFromDB(
          ctx.serverDB,
          getProviderConfigScopeUserId({ requestedScope: input.scope, userId: ctx.userId }),
          input.id,
        );

        const response = await modelRuntime.chat({
          messages: [{ content: 'Hi', role: 'user' }],
          model,
          stream: false,
          temperature: 0,
        });

        // If we get a response without error, connectivity is ok
        if (response.ok) {
          return { model, ok: true };
        }

        const errorBody = await response.text();
        return { error: errorBody, model, ok: false, status: response.status };
      } catch (error) {
        return { error: getConnectivityErrorMessage(error), model, ok: false };
      }
    }),

  createAiProvider: aiProviderProcedure
    .input(scopedCreateAiProviderSchema)
    .mutation(async ({ input, ctx }) => {
      await assertProviderScopeWritable({
        commercial: ctx.commercial,
        selector: input,
        serverDB: ctx.serverDB,
        userId: ctx.userId,
      });

      const { scope, ...value } = input;
      const aiProviderModel = createAiProviderModel({ ctx, scope });

      try {
        const data = await aiProviderModel.create(value, ctx.gateKeeper.encrypt);
        return data?.id;
      } catch (error) {
        const pgErrorCode = getErrorCode(error);
        if (pgErrorCode === '23505') {
          throw new TRPCError({
            code: 'CONFLICT',
            message: `Provider "${input.id}" already exists`,
          });
        }
        throw error;
      }
    }),

  getAiProviderById: aiProviderProcedure
    .input(providerIdInputSchema)

    .query(async ({ input, ctx }): Promise<AiProviderDetailItem | undefined> => {
      if (isGlobalProviderScope(input.scope)) {
        await assertGlobalProviderScopeReadable({
          db: ctx.serverDB,
          selector: input,
          userId: ctx.userId,
        });
      }

      const aiInfraRepos = shouldReadGlobalProviderScope({
        commercial: ctx.commercial,
        scope: input.scope,
      })
        ? createAiProviderRepos({
            aiProvider: ctx.aiProviderConfig,
            ctx,
            platformHostedModelsEnabled: ctx.commercial?.platformHostedModels.enabled ?? false,
            scope: ProviderConfigScope.Global,
          })
        : ctx.aiInfraRepos;

      const detail = await aiInfraRepos.getAiProviderDetail(
        input.id,
        KeyVaultsGateKeeper.getUserKeyVaults,
      );

      return sanitizeProviderDetailForPlatformUser(
        detail,
        ctx.commercial?.platformHostedModels.enabled === true &&
          !isGlobalProviderScope(input.scope),
      );
    }),

  getAiProviderList: aiProviderProcedure
    .input(providerScopeInputSchema)
    .query(async ({ ctx, input }) => {
      if (isGlobalProviderScope(input?.scope)) {
        await assertGlobalProviderScopeReadable({
          db: ctx.serverDB,
          selector: input,
          userId: ctx.userId,
        });
      }

      const aiInfraRepos = shouldReadGlobalProviderScope({
        commercial: ctx.commercial,
        scope: input?.scope,
      })
        ? createAiProviderRepos({
            aiProvider: ctx.aiProviderConfig,
            ctx,
            platformHostedModelsEnabled: ctx.commercial?.platformHostedModels.enabled ?? false,
            scope: ProviderConfigScope.Global,
          })
        : ctx.aiInfraRepos;

      return await aiInfraRepos.getAiProviderList();
    }),

  getAiProviderRuntimeState: aiProviderProcedure
    .input(z.object({ isLogin: z.boolean().optional(), scope: providerConfigScopeSchema }))
    .query(async ({ ctx, input }): Promise<AiProviderRuntimeState> => {
      if (isGlobalProviderScope(input.scope)) {
        await assertGlobalProviderScopeReadable({
          db: ctx.serverDB,
          selector: input,
          userId: ctx.userId,
        });
      }

      const aiInfraRepos = shouldReadGlobalProviderScope({
        commercial: ctx.commercial,
        scope: input.scope,
      })
        ? createAiProviderRepos({
            aiProvider: ctx.aiProviderConfig,
            ctx,
            platformHostedModelsEnabled: ctx.commercial?.platformHostedModels.enabled ?? false,
            scope: ProviderConfigScope.Global,
          })
        : ctx.aiInfraRepos;

      const runtimeState = await aiInfraRepos.getAiProviderRuntimeState(
        KeyVaultsGateKeeper.getUserKeyVaults,
      );

      return sanitizeRuntimeStateForPlatformUser(
        runtimeState,
        ctx.commercial?.platformHostedModels.enabled === true &&
          !isGlobalProviderScope(input.scope),
      );
    }),

  removeAiProvider: aiProviderProcedure
    .input(providerIdInputSchema)
    .mutation(async ({ input, ctx }) => {
      await assertProviderScopeWritable({
        commercial: ctx.commercial,
        selector: input,
        serverDB: ctx.serverDB,
        userId: ctx.userId,
      });

      return createAiProviderModel({ ctx, scope: input.scope }).delete(input.id);
    }),

  toggleProviderEnabled: aiProviderProcedure
    .input(
      z.object({
        enabled: z.boolean(),
        id: z.string(),
        scope: providerConfigScopeSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await assertProviderScopeWritable({
        commercial: ctx.commercial,
        selector: input,
        serverDB: ctx.serverDB,
        userId: ctx.userId,
      });

      return createAiProviderModel({ ctx, scope: input.scope }).toggleProviderEnabled(
        input.id,
        input.enabled,
      );
    }),

  updateAiProvider: aiProviderProcedure
    .input(
      z.object({
        id: z.string(),
        scope: providerConfigScopeSchema,
        value: UpdateAiProviderSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await assertProviderScopeWritable({
        commercial: ctx.commercial,
        selector: input,
        serverDB: ctx.serverDB,
        userId: ctx.userId,
      });

      return createAiProviderModel({ ctx, scope: input.scope }).update(input.id, input.value);
    }),

  updateAiProviderConfig: aiProviderProcedure
    .input(
      z.object({
        id: z.string(),
        scope: providerConfigScopeSchema,
        value: UpdateAiProviderConfigSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await assertProviderScopeWritable({
        commercial: ctx.commercial,
        selector: input,
        serverDB: ctx.serverDB,
        userId: ctx.userId,
      });

      return createAiProviderModel({ ctx, scope: input.scope }).updateConfig(
        input.id,
        input.value,
        ctx.gateKeeper.encrypt,
        KeyVaultsGateKeeper.getUserKeyVaults,
      );
    }),

  updateAiProviderOrder: aiProviderProcedure
    .input(
      z.object({
        scope: providerConfigScopeSchema,
        sortMap: z.array(
          z.object({
            id: z.string(),
            sort: z.number(),
          }),
        ),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await assertProviderScopeWritable({
        commercial: ctx.commercial,
        selector: input,
        serverDB: ctx.serverDB,
        userId: ctx.userId,
      });

      return createAiProviderModel({ ctx, scope: input.scope }).updateOrder(input.sortMap);
    }),
});

export type AiProviderRouter = typeof aiProviderRouter;
