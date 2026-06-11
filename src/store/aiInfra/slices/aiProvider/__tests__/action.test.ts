import * as runtimeModule from '@lobechat/model-runtime';
import { renderHook, waitFor } from '@testing-library/react';
import type {
  AIImageModelCard,
  AiProviderModelListItem,
  EnabledAiModel,
  ModelParamsSchema,
  Pricing,
} from 'model-bank';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mutate } from '@/libs/swr';
import { aiProviderService } from '@/services/aiProvider';
import { useAiInfraStore as useStore } from '@/store/aiInfra/store';
import { useUserStore } from '@/store/user';
import { AiProviderSourceEnum } from '@/types/aiProvider';
import { withSWR } from '~test-utils';

import {
  getChatModelList,
  getImageModelList,
  normalizeChatModel,
  normalizeImageModel,
  normalizeVideoModel,
} from '../action';

vi.mock('@/libs/swr', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await importOriginal<typeof import('@/libs/swr')>();
  return {
    ...actual,
    mutate: vi.fn(),
  };
});

const createChatModel = (overrides: Partial<EnabledAiModel> = {}): EnabledAiModel => ({
  abilities: overrides.abilities ?? { functionCall: true },
  contextWindowTokens: overrides.contextWindowTokens ?? 8192,
  displayName: overrides.displayName ?? 'Chat Model',
  enabled: overrides.enabled ?? true,
  id: overrides.id ?? 'chat-model',
  providerId: overrides.providerId ?? 'openai',
  type: 'chat',
  ...overrides,
});

const createProviderModelListItem = (
  overrides: Partial<AiProviderModelListItem> = {},
): AiProviderModelListItem => ({
  abilities: overrides.abilities ?? {},
  displayName: overrides.displayName ?? 'Chat Model',
  enabled: overrides.enabled ?? true,
  id: overrides.id ?? 'chat-model',
  source: overrides.source ?? 'builtin',
  type: overrides.type ?? 'chat',
  ...overrides,
});

type ImageEnabledModel = EnabledAiModel & AIImageModelCard;

const emptyQueryResult = {
  command: '',
  fields: [],
  oid: 0,
  rowCount: 0,
  rows: [],
};

const createImageModel = (overrides: Partial<ImageEnabledModel> = {}): ImageEnabledModel => ({
  abilities: overrides.abilities ?? {},
  contextWindowTokens: overrides.contextWindowTokens,
  displayName: overrides.displayName ?? 'Image Model',
  enabled: overrides.enabled ?? true,
  id: overrides.id ?? 'image-model',
  providerId: overrides.providerId ?? 'openai',
  type: 'image',
  ...overrides,
});

const createVideoModel = (overrides: Partial<EnabledAiModel> = {}): EnabledAiModel => ({
  abilities: overrides.abilities ?? {},
  contextWindowTokens: overrides.contextWindowTokens,
  displayName: overrides.displayName ?? 'Video Model',
  enabled: overrides.enabled ?? true,
  id: overrides.id ?? 'video-model',
  providerId: overrides.providerId ?? 'local-new-api',
  type: 'video',
  ...overrides,
});

describe('aiProvider action helpers', () => {
  beforeEach(() => {
    vi.spyOn(runtimeModule, 'getModelPropertyWithFallback').mockResolvedValue(undefined);
  });

  describe('scope forwarding', () => {
    it('passes global scope to provider service calls', async () => {
      useStore.setState({ activeProviderConfigScope: 'global', aiProviderLoadingIds: [] });
      vi.spyOn(useStore.getState(), 'refreshAiProviderList').mockResolvedValue(undefined);
      const serviceSpy = vi
        .spyOn(aiProviderService, 'toggleProviderEnabled')
        .mockResolvedValue(emptyQueryResult);

      await useStore.getState().toggleProviderEnabled('newapi-openai-relay', true);

      expect(serviceSpy).toHaveBeenCalledWith('newapi-openai-relay', true, { scope: 'global' });
    });

    it('sets active provider config scope without clearing runtime enabled model lists', () => {
      const runtimeConfig = {
        openai: { config: {}, keyVaults: {}, settings: {} },
      };
      const enabledModel = createChatModel({ id: 'stale-enabled-model' });
      const enabledProvider = {
        id: 'openai',
        name: 'OpenAI',
        source: AiProviderSourceEnum.Builtin,
      };
      const enabledProviderWithModels = {
        children: [enabledModel],
        id: 'openai',
        name: 'OpenAI',
        source: AiProviderSourceEnum.Builtin,
      };

      useStore.setState({
        activeAiProvider: 'openai',
        activeProviderModelList: [{ id: 'stale-active-model' }],
        activeProviderConfigScope: 'user',
        aiProviderRuntimeConfig: runtimeConfig,
        aiModelLoadingIds: ['model-1'],
        aiProviderDetailMap: {
          openai: {
            enabled: true,
            id: 'openai',
            name: 'OpenAI',
            settings: {},
            source: 'custom',
          },
        },
        aiProviderList: [{ enabled: true, id: 'openai', name: 'OpenAI', source: 'custom' }],
        aiProviderModelList: [createProviderModelListItem({ id: 'stale-model' })],
        enabledAiModels: [enabledModel],
        enabledAiProviders: [enabledProvider],
        enabledChatModelList: [enabledProviderWithModels],
        enabledImageModelList: [enabledProviderWithModels],
        enabledVideoModelList: [enabledProviderWithModels],
        initAiProviderList: true,
        isAiModelListInit: true,
        isInitAiProviderRuntimeState: true,
      });

      useStore.getState().setActiveProviderConfigScope('global');

      expect(useStore.getState()).toMatchObject({
        activeAiProvider: undefined,
        activeProviderModelList: [],
        activeProviderConfigScope: 'global',
        aiModelLoadingIds: [],
        aiProviderDetailMap: {},
        aiProviderList: [],
        aiProviderModelList: [],
        aiProviderRuntimeConfig: {},
        enabledAiModels: [enabledModel],
        enabledAiProviders: [enabledProvider],
        enabledChatModelList: [enabledProviderWithModels],
        enabledImageModelList: [enabledProviderWithModels],
        enabledVideoModelList: [enabledProviderWithModels],
        initAiProviderList: false,
        isAiModelListInit: false,
        isInitAiProviderRuntimeState: true,
      });
    });

    it('keeps runtime state fetch on user scope while global provider settings are active', async () => {
      useStore.setState({ activeProviderConfigScope: 'global' });
      useUserStore.setState({ isLoaded: true });

      const runtimeStateSpy = vi
        .spyOn(aiProviderService, 'getAiProviderRuntimeState')
        .mockResolvedValue({
          enabledAiModels: [],
          enabledAiProviders: [],
          enabledChatAiProviders: [],
          enabledImageAiProviders: [],
          enabledVideoAiProviders: [],
          runtimeConfig: {},
        });

      const { result } = renderHook(() => useStore((s) => s.useFetchAiProviderRuntimeState)(true), {
        wrapper: withSWR,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(runtimeStateSpy).toHaveBeenCalledWith(undefined, { scope: 'user' });
    });

    it('refreshes user runtime state keys while global provider settings are active', async () => {
      useStore.setState({ activeProviderConfigScope: 'global' });

      await useStore.getState().refreshAiProviderRuntimeState();

      expect(mutate).toHaveBeenCalledWith(['FETCH_AI_PROVIDER_RUNTIME_STATE', 'user', true]);
      expect(mutate).toHaveBeenCalledWith(['FETCH_AI_PROVIDER_RUNTIME_STATE', 'user', false]);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('normalizeChatModel', () => {
    it('fills missing optional fields with safe defaults', async () => {
      const model = createChatModel({
        abilities: undefined,
        contextWindowTokens: undefined,
        displayName: undefined,
      });

      const result = await normalizeChatModel(model);

      expect(result).toEqual({
        abilities: {},
        contextWindowTokens: undefined,
        displayName: '',
        id: 'chat-model',
      });
    });

    it('preserves inline metadata without loading fallback model config', async () => {
      const fallbackSpy = vi.spyOn(runtimeModule, 'getModelPropertyWithFallback');
      const pricing: Pricing = {
        units: [{ name: 'textInput', rate: 1.25, strategy: 'fixed', unit: 'millionTokens' }],
      };
      const model = {
        ...createChatModel({ id: 'online-chat-model', providerId: 'lobehub' }),
        description: 'Inline description',
        pricing,
      };

      const result = await normalizeChatModel(model);

      expect(result.description).toBe('Inline description');
      expect(result.pricing).toBe(pricing);
      expect(fallbackSpy).not.toHaveBeenCalled();
    });
  });

  describe('normalizeImageModel', () => {
    it('preserves inline metadata and pricing information', async () => {
      const model = createImageModel({
        abilities: { vision: true },
        contextWindowTokens: 4096,
        displayName: 'Inline Model',
        parameters: {
          prompt: { default: '' },
          size: { default: '1024x1024', enum: ['512x512', '1024x1024'] },
        } as ModelParamsSchema,
        pricing: {
          units: [{ name: 'imageGeneration', rate: 0.04, strategy: 'fixed', unit: 'image' }],
        },
      });

      const result = await normalizeImageModel(model);

      expect(result).toMatchObject({
        abilities: { vision: true },
        displayName: 'Inline Model',
        parameters: { size: { default: '1024x1024', enum: ['512x512', '1024x1024'] } },
        pricing: {
          units: [{ name: 'imageGeneration', rate: 0.04, strategy: 'fixed', unit: 'image' }],
        },
      });
    });

    it('fetches fallback description/parameters/pricing when missing', async () => {
      const fallbackSpy = vi
        .mocked(runtimeModule.getModelPropertyWithFallback)
        .mockImplementation(async (_id, key) => {
          if (key === 'parameters')
            return {
              prompt: { default: '' },
              size: { default: '768x768', enum: ['512x512', '768x768'] },
            } satisfies ModelParamsSchema;
          if (key === 'pricing')
            return {
              units: [{ name: 'imageGeneration', rate: 0.02, strategy: 'fixed', unit: 'image' }],
            };
          if (key === 'description') return 'Fallback description';
          return undefined;
        });

      const model = createImageModel({
        id: 'stable-diffusion',
        providerId: 'stability',
        parameters: undefined,
        pricing: undefined,
      });

      const result = await normalizeImageModel(model);

      expect(result.parameters).toEqual({
        prompt: { default: '' },
        size: { default: '768x768', enum: ['512x512', '768x768'] },
      });
      expect(result.pricing).toEqual({
        units: [{ name: 'imageGeneration', rate: 0.02, strategy: 'fixed', unit: 'image' }],
      });
      expect(result.description).toBe('Fallback description');
      expect(fallbackSpy).toHaveBeenCalledWith('stable-diffusion', 'parameters', 'stability');
      expect(fallbackSpy).toHaveBeenCalledWith('stable-diffusion', 'pricing', 'stability');
      expect(fallbackSpy).toHaveBeenCalledWith('stable-diffusion', 'description', 'stability');
    });
  });

  describe('normalizeVideoModel', () => {
    it('fetches fallback parameters when remote video model stores an empty parameters object', async () => {
      const fallbackParameters = {
        aspectRatio: { default: 'adaptive', enum: ['adaptive', '16:9'] },
        duration: { default: 5, max: 15, min: 4 },
        prompt: { default: '' },
        resolution: { default: '720p', enum: ['480p', '720p', '1080p'] },
      } satisfies ModelParamsSchema;
      const fallbackSpy = vi
        .mocked(runtimeModule.getModelPropertyWithFallback)
        .mockImplementation(async (_id, key) => {
          if (key === 'parameters') return fallbackParameters;
          return undefined;
        });

      const model = createVideoModel({
        id: 'doubao-seedance-2.0',
        parameters: {},
        providerId: 'local-new-api',
      });

      const result = await normalizeVideoModel(model);

      expect(result.parameters).toEqual(fallbackParameters);
      expect(fallbackSpy).toHaveBeenCalledWith(
        'doubao-seedance-2.0',
        'parameters',
        'local-new-api',
      );
    });
  });

  describe('getChatModelList', () => {
    const chatModels = [
      createChatModel({ id: 'gpt-4', providerId: 'openai', displayName: 'GPT-4' }),
      createChatModel({ id: 'gpt-3.5', providerId: 'openai', displayName: 'GPT-3.5' }),
      createChatModel({ id: 'claude-3', providerId: 'anthropic', displayName: 'Claude 3' }),
    ];

    it('filters by provider and deduplicates IDs', async () => {
      const duplicated = [
        ...chatModels,
        createChatModel({ id: 'gpt-4', providerId: 'openai', displayName: 'GPT-4 Duplicate' }),
      ];

      const result = await getChatModelList(duplicated, 'openai');

      expect(result).toHaveLength(2);
      expect(result.map((m) => m.id)).toEqual(['gpt-4', 'gpt-3.5']);
      expect(result[0].displayName).toBe('GPT-4');
    });

    it('returns empty array when provider has no chat models', async () => {
      const result = await getChatModelList(chatModels, 'nonexistent');
      expect(result).toEqual([]);
    });

    it('filters runtime-only hidden models from visible chat lists', async () => {
      const result = await getChatModelList(
        [
          createChatModel({
            displayName: 'Visible Model',
            id: 'visible-model',
            providerId: 'lobehub',
          }),
          createChatModel({
            displayName: 'Onboarding Alias',
            id: 'lobehub-onboarding-v1',
            providerId: 'lobehub',
            visible: false,
          }),
        ],
        'lobehub',
      );

      expect(result.map((model) => model.id)).toEqual(['visible-model']);
    });
  });

  describe('getImageModelList', () => {
    const imageModels = [
      createImageModel({ id: 'dall-e-3', providerId: 'openai', displayName: 'DALL-E 3' }),
      createImageModel({ id: 'midjourney', providerId: 'midjourney', displayName: 'Midjourney' }),
    ];

    it('collects normalized image models for a provider', async () => {
      const result = await getImageModelList(imageModels, 'openai');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('dall-e-3');
      expect(result[0].displayName).toBe('DALL-E 3');
    });

    it('returns empty array when provider has no image models', async () => {
      const result = await getImageModelList(imageModels, 'unknown');
      expect(result).toEqual([]);
    });
  });
});
