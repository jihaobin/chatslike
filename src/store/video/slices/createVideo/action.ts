import { ENABLE_BUSINESS_FEATURES } from '@lobechat/business-const';
import { t } from 'i18next';

import { handleGenerationPromptModerationError } from '@/business/client/handleGenerationPromptModerationError';
import { handleLobeHubModelDeprecatedError } from '@/business/client/handleLobeHubModelDeprecatedError';
import { handlePlatformProviderError } from '@/business/client/handlePlatformProviderError';
import { markUserValidAction } from '@/business/client/markUserValidAction';
import { message } from '@/components/AntdStaticMethods';
import { generationService } from '@/services/generation';
import { videoService } from '@/services/video';
import { aiProviderSelectors, getAiInfraStoreState } from '@/store/aiInfra';
import { type StoreSetter } from '@/store/types';
import { AsyncTaskStatus } from '@/types/asyncTask';
import type { Generation, GenerationBatch } from '@/types/generation';

import { type VideoStore } from '../../store';
import { generationBatchSelectors } from '../generationBatch/selectors';
import { videoGenerationConfigSelectors } from '../generationConfig/selectors';
import { generationTopicSelectors } from '../generationTopic';

type Setter = StoreSetter<VideoStore>;

const getFirstEnabledVideoModel = () => {
  const enabledVideoModelList = aiProviderSelectors.enabledVideoModelList(getAiInfraStoreState());

  for (const providerItem of enabledVideoModelList) {
    const modelItem = providerItem.children[0];
    if (modelItem) return { model: modelItem.id, provider: providerItem.id };
  }
};

const getEffectiveVideoModel = (model: string, provider: string) => {
  const enabledVideoModelList = aiProviderSelectors.enabledVideoModelList(getAiInfraStoreState());
  const currentModel = enabledVideoModelList
    .flatMap((providerItem) =>
      providerItem.children.map((modelItem) => ({ model: modelItem.id, provider: providerItem.id })),
    )
    .find((item) => item.model === model && item.provider === provider);

  return currentModel ?? getFirstEnabledVideoModel();
};

type CreatedGeneration = Omit<Generation, 'task'> & Partial<Pick<Generation, 'task'>>;

const normalizeCreatedGenerations = (generations: CreatedGeneration[]): Generation[] =>
  generations.map((generation) => ({
    ...generation,
    task: generation.task ?? {
      id: generation.asyncTaskId ?? generation.id,
      status: AsyncTaskStatus.Pending,
    },
  }));

const createGenerationBatchPayload = (
  batch: Omit<GenerationBatch, 'config' | 'generations'>,
  generations: CreatedGeneration[],
  config: GenerationBatch['config'],
): GenerationBatch => ({
  avgLatencyMs: batch.avgLatencyMs,
  config,
  createdAt: batch.createdAt,
  generations: normalizeCreatedGenerations(generations),
  height: batch.height,
  id: batch.id,
  model: batch.model,
  prompt: batch.prompt,
  provider: batch.provider,
  width: batch.width,
});

export const createCreateVideoSlice = (set: Setter, get: () => VideoStore, _api?: unknown) =>
  new CreateVideoActionImpl(set, get, _api);

export class CreateVideoActionImpl {
  readonly #get: () => VideoStore;
  readonly #set: Setter;

  constructor(set: Setter, get: () => VideoStore, _api?: unknown) {
    void _api;
    this.#set = set;
    this.#get = get;
  }

  createVideo = async (): Promise<void> => {
    this.#set({ isCreating: true }, false, 'createVideo/startCreateVideo');

    let store = this.#get();
    let parameters = videoGenerationConfigSelectors.parameters(store);
    let provider = videoGenerationConfigSelectors.provider(store);
    let model = videoGenerationConfigSelectors.model(store);
    const activeGenerationTopicId = generationTopicSelectors.activeGenerationTopicId(store);
    const { createGenerationTopic, switchGenerationTopic, setTopicBatchLoaded } = store;

    const effectiveModel = getEffectiveVideoModel(model, provider);

    if (!effectiveModel) {
      message.warning({
        content: t('ModelSwitchPanel.emptyModel', { ns: 'components' }),
        duration: 3,
      });
      this.#set({ isCreating: false }, false, 'createVideo/endCreateVideo');
      return;
    }

    if (effectiveModel.model !== model || effectiveModel.provider !== provider) {
      this.#get().setModelAndProviderOnSelect(effectiveModel.model, effectiveModel.provider);

      store = this.#get();
      parameters = videoGenerationConfigSelectors.parameters(store);
      provider = videoGenerationConfigSelectors.provider(store);
      model = videoGenerationConfigSelectors.model(store);
    }

    if (!parameters) {
      throw new TypeError('parameters is not initialized');
    }

    if (!parameters.prompt) {
      throw new TypeError('prompt is empty');
    }

    // Validate: end frame requires start frame (driven by model schema)
    const parametersSchema = videoGenerationConfigSelectors.parametersSchema(store);
    const endImageUrlSchema = parametersSchema?.endImageUrl;
    if (
      endImageUrlSchema &&
      'requiresImageUrl' in endImageUrlSchema &&
      endImageUrlSchema.requiresImageUrl &&
      parameters.endImageUrl &&
      !parameters.imageUrl &&
      !parameters.imageUrls?.length
    ) {
      message.warning({
        content: t('generation.validation.endFrameRequiresStartFrame', { ns: 'video' }),
        duration: 3,
      });
      this.#set({ isCreating: false }, false, 'createVideo/endCreateVideo');
      return;
    }

    let finalTopicId = activeGenerationTopicId;

    // 1. Create generation topic if not exists
    const generationTopicId = activeGenerationTopicId;
    let isNewTopic = false;

    if (!generationTopicId) {
      isNewTopic = true;
      const prompts = [parameters.prompt];
      const newGenerationTopicId = await createGenerationTopic(prompts);
      finalTopicId = newGenerationTopicId;

      // 2. Initialize empty batch array to avoid skeleton screen
      setTopicBatchLoaded(newGenerationTopicId);

      // 3. Switch to the new topic (now it has empty data, so no skeleton screen)
      switchGenerationTopic(newGenerationTopicId);
    }

    try {
      // 3. If it's a new topic, set the creating state after topic creation
      if (isNewTopic) {
        this.#set(
          { isCreatingWithNewTopic: true },
          false,
          'createVideo/startCreateVideoWithNewTopic',
        );
      }

      if (ENABLE_BUSINESS_FEATURES) {
        markUserValidAction();
      }

      // 4. Create video via service
      const result = await videoService.createVideo({
        generationTopicId: finalTopicId!,
        model,
        params: parameters as any,
        provider,
      });

      if (result?.data?.batch && result.data.generations) {
        this.#get().internal_dispatchGenerationBatch(
          finalTopicId!,
          {
            type: 'addBatch',
            value: createGenerationBatchPayload(result.data.batch, result.data.generations, parameters),
          },
          'createVideo/addCreatedBatch',
        );
      }

      // 5. Refresh generation batches to show the new batch
      if (!isNewTopic) {
        await this.#get().refreshGenerationBatches();
      }

      // 6. Clear the prompt input after successful video creation
      this.#set(
        (state) => ({
          parameters: { ...state.parameters, prompt: '' },
        }),
        false,
        'createVideo/clearPrompt',
      );
    } catch (error) {
      handleGenerationPromptModerationError(error);
      handleLobeHubModelDeprecatedError(error);
      handlePlatformProviderError(error);
      throw error;
    } finally {
      // 7. Reset all creating states
      if (isNewTopic) {
        this.#set(
          { isCreating: false, isCreatingWithNewTopic: false },
          false,
          'createVideo/endCreateVideoWithNewTopic',
        );
      } else {
        this.#set({ isCreating: false }, false, 'createVideo/endCreateVideo');
      }
    }
  };

  recreateVideo = async (generationBatchId: string): Promise<void> => {
    this.#set({ isCreating: true }, false, 'recreateVideo/start');

    const store = this.#get();
    const activeGenerationTopicId = generationTopicSelectors.activeGenerationTopicId(store);
    if (!activeGenerationTopicId) {
      throw new Error('No active generation topic');
    }

    const { removeGenerationBatch } = store;
    const batch = generationBatchSelectors.getGenerationBatchByBatchId(generationBatchId)(store)!;

    try {
      await removeGenerationBatch(generationBatchId, activeGenerationTopicId);

      const result = await videoService.createVideo({
        generationTopicId: activeGenerationTopicId,
        model: batch.model,
        params: batch.config as any,
        provider: batch.provider,
      });

      if (result?.data?.batch && result.data.generations) {
        this.#get().internal_dispatchGenerationBatch(
          activeGenerationTopicId,
          {
            type: 'addBatch',
            value: createGenerationBatchPayload(
              result.data.batch,
              result.data.generations,
              batch.config,
            ),
          },
          'recreateVideo/addCreatedBatch',
        );
      }

      await store.refreshGenerationBatches();
    } catch (error) {
      handleGenerationPromptModerationError(error);
      handleLobeHubModelDeprecatedError(error);
      handlePlatformProviderError(error);
      throw error;
    } finally {
      this.#set({ isCreating: false }, false, 'recreateVideo/end');
    }
  };

  retryVideoGenerationTask = async (generationId: string, asyncTaskId: string): Promise<void> => {
    await generationService.retryVideoGenerationTask(generationId, asyncTaskId);
    await this.#get().refreshGenerationBatches();
  };
}

export type CreateVideoAction = Pick<CreateVideoActionImpl, keyof CreateVideoActionImpl>;
