import type { AiProviderRuntimeConfig, EnabledProvider } from '@lobechat/types';
import { eq } from 'drizzle-orm';
import type { EnabledAiModel } from 'model-bank';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { getTestDB } from '../../../core/getTestDB';
import { aiModels, aiProviders, users } from '../../../schemas';
import type { LobeChatDatabase } from '../../../type';
import { GLOBAL_PROVIDER_CONFIG_USER_ID } from '../constants';
import { AiInfraRepos } from '../index';

const userId = 'test-user-id';
const mockProviderConfigs = {
  openai: { enabled: true },
  anthropic: { enabled: false },
};

const createRuntimeConfig = (apiKey: string): AiProviderRuntimeConfig => ({
  config: {},
  keyVaults: { apiKey },
  settings: {},
});

let serverDB: LobeChatDatabase;
let repo: AiInfraRepos;

beforeAll(async () => {
  serverDB = await getTestDB();
}, 30000);

beforeEach(async () => {
  vi.clearAllMocks();
  await serverDB.delete(users).where(eq(users.id, GLOBAL_PROVIDER_CONFIG_USER_ID));
  await serverDB.delete(users).where(eq(users.id, userId));
  repo = new AiInfraRepos(serverDB, userId, mockProviderConfigs);
});

describe('AiInfraRepos', () => {
  describe('getAiProviderRuntimeState', () => {
    it('should return complete runtime state', async () => {
      const mockRuntimeConfig = {
        openai: createRuntimeConfig('test-key'),
      } satisfies Record<string, AiProviderRuntimeConfig>;
      const mockEnabledProviders = [{ id: 'openai', name: 'OpenAI' }] as EnabledProvider[];
      const mockEnabledModels = [
        { id: 'gpt-4', providerId: 'openai', enabled: true },
      ] as EnabledAiModel[];

      vi.spyOn(repo.aiProviderModel, 'getAiProviderRuntimeConfig').mockResolvedValue(
        mockRuntimeConfig,
      );
      vi.spyOn(repo, 'getUserEnabledProviderList').mockResolvedValue(mockEnabledProviders);
      vi.spyOn(repo, 'getEnabledModels').mockResolvedValue(mockEnabledModels);

      const result = await repo.getAiProviderRuntimeState();

      expect(result).toMatchObject({
        enabledAiProviders: mockEnabledProviders,
        enabledAiModels: mockEnabledModels,
        runtimeConfig: expect.any(Object),
      });
    });

    it('should return provider runtime state', async () => {
      const mockRuntimeConfig = {
        openai: createRuntimeConfig('test-key'),
      } satisfies Record<string, AiProviderRuntimeConfig>;

      vi.spyOn(repo.aiProviderModel, 'getAiProviderRuntimeConfig').mockResolvedValue(
        mockRuntimeConfig,
      );

      vi.spyOn(repo, 'getUserEnabledProviderList').mockResolvedValue([
        { id: 'openai', logo: 'logo1', name: 'OpenAI', source: 'builtin' },
      ]);

      vi.spyOn(repo, 'getEnabledModels').mockResolvedValue([
        {
          abilities: {},
          enabled: true,
          id: 'gpt-4',
          providerId: 'openai',
          type: 'chat',
        },
      ]);

      const result = await repo.getAiProviderRuntimeState();

      expect(result).toEqual({
        enabledAiModels: [
          expect.objectContaining({
            enabled: true,
            id: 'gpt-4',
            providerId: 'openai',
          }),
        ],
        enabledAiProviders: [{ id: 'openai', logo: 'logo1', name: 'OpenAI', source: 'builtin' }],
        enabledChatAiProviders: [
          { id: 'openai', logo: 'logo1', name: 'OpenAI', source: 'builtin' },
        ],
        enabledImageAiProviders: [],
        enabledVideoAiProviders: [],
        runtimeConfig: {
          openai: {
            config: {},
            enabled: true,
            keyVaults: { apiKey: 'test-key' },
            settings: {},
          },
        },
      });
    });

    it('should return provider runtime state with enabledImageAiProviders', async () => {
      const mockRuntimeConfig = {
        fal: {
          ...createRuntimeConfig('test-fal-key'),
        },
        openai: {
          ...createRuntimeConfig('test-openai-key'),
        },
      } satisfies Record<string, AiProviderRuntimeConfig>;

      vi.spyOn(repo.aiProviderModel, 'getAiProviderRuntimeConfig').mockResolvedValue(
        mockRuntimeConfig,
      );

      // Mock providers including fal for image generation
      vi.spyOn(repo, 'getUserEnabledProviderList').mockResolvedValue([
        { id: 'openai', logo: 'openai-logo', name: 'OpenAI', source: 'builtin' },
        { id: 'fal', logo: 'fal-logo', name: 'Fal', source: 'builtin' },
      ]);

      // Mock models including image models from fal
      vi.spyOn(repo, 'getEnabledModels').mockResolvedValue([
        {
          abilities: {},
          enabled: true,
          id: 'gpt-4',
          providerId: 'openai',
          type: 'chat',
        },
        {
          abilities: {},
          enabled: true,
          id: 'flux/schnell',
          providerId: 'fal',
          type: 'image',
        },
        {
          abilities: {},
          enabled: true,
          id: 'flux-kontext/dev',
          providerId: 'fal',
          type: 'image',
        },
      ]);

      const result = await repo.getAiProviderRuntimeState();

      expect(result).toEqual({
        enabledAiModels: [
          expect.objectContaining({
            enabled: true,
            id: 'gpt-4',
            providerId: 'openai',
            type: 'chat',
          }),
          expect.objectContaining({
            enabled: true,
            id: 'flux/schnell',
            providerId: 'fal',
            type: 'image',
          }),
          expect.objectContaining({
            enabled: true,
            id: 'flux-kontext/dev',
            providerId: 'fal',
            type: 'image',
          }),
        ],
        enabledAiProviders: [
          { id: 'openai', logo: 'openai-logo', name: 'OpenAI', source: 'builtin' },
          { id: 'fal', logo: 'fal-logo', name: 'Fal', source: 'builtin' },
        ],
        enabledChatAiProviders: [
          { id: 'openai', logo: 'openai-logo', name: 'OpenAI', source: 'builtin' },
        ],
        enabledImageAiProviders: [
          expect.objectContaining({
            id: 'fal',
            name: 'Fal',
          }),
        ],
        enabledVideoAiProviders: [],
        runtimeConfig: {
          fal: {
            config: {},
            keyVaults: { apiKey: 'test-fal-key' },
            settings: {},
          },
          openai: {
            config: {},
            enabled: true,
            keyVaults: { apiKey: 'test-openai-key' },
            settings: {},
          },
        },
      });
    });

    it('uses all enabled global providers in platform hosted mode', async () => {
      await serverDB.insert(users).values([{ id: GLOBAL_PROVIDER_CONFIG_USER_ID }, { id: userId }]);
      await serverDB.insert(aiProviders).values([
        {
          enabled: true,
          id: 'newapi-openai-relay',
          name: 'OpenAI Relay',
          source: 'custom',
          sort: 1,
          userId: GLOBAL_PROVIDER_CONFIG_USER_ID,
        },
        {
          enabled: true,
          id: 'newapi-claude-relay',
          name: 'Claude Relay',
          source: 'custom',
          sort: 2,
          userId: GLOBAL_PROVIDER_CONFIG_USER_ID,
        },
        {
          enabled: false,
          id: 'disabled-relay',
          name: 'Disabled Relay',
          source: 'custom',
          sort: 3,
          userId: GLOBAL_PROVIDER_CONFIG_USER_ID,
        },
      ]);
      await serverDB.insert(aiModels).values([
        {
          enabled: true,
          id: 'gpt-4o',
          providerId: 'newapi-openai-relay',
          source: 'custom',
          type: 'chat',
          userId: GLOBAL_PROVIDER_CONFIG_USER_ID,
        },
        {
          enabled: true,
          id: 'claude-sonnet-4',
          providerId: 'newapi-claude-relay',
          source: 'custom',
          type: 'chat',
          userId: GLOBAL_PROVIDER_CONFIG_USER_ID,
        },
        {
          enabled: true,
          id: 'disabled-provider-model',
          providerId: 'disabled-relay',
          source: 'custom',
          type: 'chat',
          userId: GLOBAL_PROVIDER_CONFIG_USER_ID,
        },
        {
          enabled: false,
          id: 'disabled-model',
          providerId: 'newapi-openai-relay',
          source: 'custom',
          type: 'chat',
          userId: GLOBAL_PROVIDER_CONFIG_USER_ID,
        },
      ]);

      const platformRepo = new AiInfraRepos(
        serverDB,
        userId,
        {},
        { platformHostedModelsEnabled: true },
      );

      const result = await platformRepo.getAiProviderRuntimeState();

      expect(result.enabledAiProviders.map((provider) => provider.id)).toEqual([
        'newapi-openai-relay',
        'newapi-claude-relay',
      ]);
      expect(result.enabledAiModels.map((model) => `${model.providerId}:${model.id}`)).toEqual([
        'newapi-openai-relay:gpt-4o',
        'newapi-claude-relay:claude-sonnet-4',
      ]);
      expect(result.enabledChatAiProviders.map((provider) => provider.id)).toEqual([
        'newapi-openai-relay',
        'newapi-claude-relay',
      ]);
    });

    it('uses enabled builtin provider server model lists in platform hosted mode', async () => {
      await serverDB.insert(users).values([{ id: GLOBAL_PROVIDER_CONFIG_USER_ID }, { id: userId }]);
      await serverDB.insert(aiProviders).values({
        enabled: true,
        id: 'openai',
        name: 'OpenAI',
        source: 'builtin',
        sort: 1,
        userId: GLOBAL_PROVIDER_CONFIG_USER_ID,
      });

      const platformRepo = new AiInfraRepos(
        serverDB,
        userId,
        {
          openai: {
            enabled: true,
            serverModelLists: [
              {
                enabled: true,
                id: 'gpt-4o',
                type: 'chat',
              },
            ],
          },
        },
        { platformHostedModelsEnabled: true },
      );

      const result = await platformRepo.getAiProviderRuntimeState();

      expect(result.enabledAiProviders.map((provider) => provider.id)).toEqual(['openai']);
      expect(result.enabledAiModels.map((model) => `${model.providerId}:${model.id}`)).toEqual([
        'openai:gpt-4o',
      ]);
      expect(result.enabledChatAiProviders.map((provider) => provider.id)).toEqual(['openai']);
    });
  });
});
