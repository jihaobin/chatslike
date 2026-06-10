import { ENABLE_BUSINESS_FEATURES } from '@lobechat/business-const';
import { t } from 'i18next';

import { handleGenerationPromptModerationError } from '@/business/client/handleGenerationPromptModerationError';
import { handleLobeHubModelDeprecatedError } from '@/business/client/handleLobeHubModelDeprecatedError';
import { handlePlatformProviderError } from '@/business/client/handlePlatformProviderError';
import { markUserValidAction } from '@/business/client/markUserValidAction';
import { message } from '@/components/AntdStaticMethods';
import { imageService } from '@/services/image';
import { aiProviderSelectors, getAiInfraStoreState } from '@/store/aiInfra';
import { type StoreSetter } from '@/store/types';
import { AsyncTaskStatus } from '@/types/asyncTask';
import type { Generation, GenerationBatch } from '@/types/generation';

import { type ImageStore } from '../../store';
import { generationBatchSelectors } from '../generationBatch/selectors';
import { imageGenerationConfigSelectors } from '../generationConfig/selectors';
import { generationTopicSelectors } from '../generationTopic';

// ====== action interface ====== //

// ====== helper functions ====== //
const getFirstEnabledImageModel = () => {
  const enabledImageModelList = aiProviderSelectors.enabledImageModelList(getAiInfraStoreState());

  for (const providerItem of enabledImageModelList) {
    const modelItem = providerItem.children[0];
    if (modelItem) return { model: modelItem.id, provider: providerItem.id };
  }
};

const getEffectiveImageModel = (model: string, provider: string) => {
  const enabledImageModelList = aiProviderSelectors.enabledImageModelList(getAiInfraStoreState());
  const currentModel = enabledImageModelList
    .flatMap((providerItem) =>
      providerItem.children.map((modelItem) => ({ model: modelItem.id, provider: providerItem.id })),
    )
    .find((item) => item.model === model && item.provider === provider);

  return currentModel ?? getFirstEnabledImageModel();
};

type CreatedGeneration = Partial<Omit<Generation, 'task'>> & {
  generationBatchId: string;
  id?: string;
  task?: Generation['task'];
  userId: string;
};

const hasCreatedGenerationId = (
  generation: CreatedGeneration,
): generation is CreatedGeneration & { id: string } => Boolean(generation.id);

const normalizeCreatedGenerations = (generations: CreatedGeneration[], createdAt: Date): Generation[] =>
  generations.filter(hasCreatedGenerationId).map((generation) => ({
    asset: generation.asset,
    asyncTaskId: generation.asyncTaskId ?? null,
    createdAt: generation.createdAt ?? createdAt,
    id: generation.id,
    seed: generation.seed,
    task: generation.task ?? {
      id: generation.asyncTaskId ?? generation.id,
      status: AsyncTaskStatus.Pending,
    },
  }));

const createGenerationBatchPayload = (
  batch: Pick<GenerationBatch, 'createdAt' | 'height' | 'id' | 'model' | 'prompt' | 'provider' | 'width'>,
  generations: CreatedGeneration[],
  config: GenerationBatch['config'],
): GenerationBatch => ({
  config,
  createdAt: batch.createdAt,
  generations: normalizeCreatedGenerations(generations, batch.createdAt),
  height: batch.height,
  id: batch.id,
  model: batch.model,
  prompt: batch.prompt,
  provider: batch.provider,
  width: batch.width,
});

// ====== action implementation ====== //

type Setter = StoreSetter<ImageStore>;
export const createCreateImageSlice = (set: Setter, get: () => ImageStore, _api?: unknown) =>
  new CreateImageActionImpl(set, get, _api);

export class CreateImageActionImpl {
  readonly #get: () => ImageStore;
  readonly #set: Setter;

  constructor(set: Setter, get: () => ImageStore, _api?: unknown) {
    // keep signature aligned with StateCreator params: (set, get, api)
    void _api;
    this.#set = set;
    this.#get = get;
  }

  async createImage() {
    this.#set({ isCreating: true }, false, 'createImage/startCreateImage');

    let store = this.#get();
    let imageNum = imageGenerationConfigSelectors.imageNum(store);
    let parameters = imageGenerationConfigSelectors.parameters(store);
    let provider = imageGenerationConfigSelectors.provider(store);
    let model = imageGenerationConfigSelectors.model(store);
    const activeGenerationTopicId = generationTopicSelectors.activeGenerationTopicId(store);
    const { createGenerationTopic, switchGenerationTopic, setTopicBatchLoaded } = store;

    const effectiveModel = getEffectiveImageModel(model, provider);

    if (!effectiveModel) {
      message.warning({
        content: t('ModelSwitchPanel.emptyModel', { ns: 'components' }),
        duration: 3,
      });
      this.#set({ isCreating: false }, false, 'createImage/endCreateImage');
      return;
    }

    if (effectiveModel.model !== model || effectiveModel.provider !== provider) {
      this.#get().setModelAndProviderOnSelect(effectiveModel.model, effectiveModel.provider);

      store = this.#get();
      imageNum = imageGenerationConfigSelectors.imageNum(store);
      parameters = imageGenerationConfigSelectors.parameters(store);
      provider = imageGenerationConfigSelectors.provider(store);
      model = imageGenerationConfigSelectors.model(store);
    }

    if (!parameters) {
      throw new TypeError('parameters is not initialized');
    }

    if (!parameters.prompt) {
      throw new TypeError('prompt is empty');
    }

    // Track the final topic ID to use for image creation
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
      // 4. If it's a new topic, set the creating state after topic creation
      if (isNewTopic) {
        this.#set(
          { isCreatingWithNewTopic: true },
          false,
          'createImage/startCreateImageWithNewTopic',
        );
      }

      if (ENABLE_BUSINESS_FEATURES) {
        markUserValidAction();
      }

      // 5. Create image via service
      const result = await imageService.createImage({
        generationTopicId: finalTopicId!,
        provider,
        model,
        imageNum,
        params: parameters as any,
      });

      const createdBatch = result?.data?.batch;
      const createdGenerations = result?.data?.generations;

      if (createdBatch?.id && createdBatch.createdAt && createdGenerations) {
        this.#get().internal_dispatchGenerationBatch(
          finalTopicId!,
          {
            type: 'addBatch',
            value: createGenerationBatchPayload(
              {
                createdAt: createdBatch.createdAt,
                height: createdBatch.height,
                id: createdBatch.id,
                model: createdBatch.model,
                prompt: createdBatch.prompt,
                provider: createdBatch.provider,
                width: createdBatch.width,
              },
              createdGenerations,
              parameters,
            ),
          },
          'createImage/addCreatedBatch',
        );
      }

      // 6. Only refresh generation batches if it's not a new topic
      if (!isNewTopic) {
        await this.#get().refreshGenerationBatches();
      }

      // 7. Clear the prompt input after successful image creation
      this.#set(
        (state) => ({
          parameters: { ...state.parameters, prompt: '' },
        }),
        false,
        'createImage/clearPrompt',
      );
    } catch (error) {
      handleGenerationPromptModerationError(error);
      handleLobeHubModelDeprecatedError(error);
      handlePlatformProviderError(error);
      throw error;
    } finally {
      // 8. Reset all creating states
      if (isNewTopic) {
        this.#set(
          { isCreating: false, isCreatingWithNewTopic: false },
          false,
          'createImage/endCreateImageWithNewTopic',
        );
      } else {
        this.#set({ isCreating: false }, false, 'createImage/endCreateImage');
      }
    }
  }

  async recreateImage(generationBatchId: string) {
    this.#set({ isCreating: true }, false, 'recreateImage/startCreateImage');

    const store = this.#get();
    const activeGenerationTopicId = generationTopicSelectors.activeGenerationTopicId(store);
    if (!activeGenerationTopicId) {
      throw new Error('No active generation topic');
    }

    const { removeGenerationBatch } = store;
    const batch = generationBatchSelectors.getGenerationBatchByBatchId(generationBatchId)(store)!;

    // Use batch.generations.length to preserve original imageNum (not UI config)
    const imageNum = batch.generations.length;

    try {
      // 1. Delete generation batch
      await removeGenerationBatch(generationBatchId, activeGenerationTopicId);

      // 2. Create image via service
      const result = await imageService.createImage({
        generationTopicId: activeGenerationTopicId,
        provider: batch.provider,
        model: batch.model,
        imageNum,
        params: batch.config as any,
      });

      const createdBatch = result?.data?.batch;
      const createdGenerations = result?.data?.generations;

      if (createdBatch?.id && createdBatch.createdAt && createdGenerations) {
        this.#get().internal_dispatchGenerationBatch(
          activeGenerationTopicId,
          {
            type: 'addBatch',
            value: createGenerationBatchPayload(
              {
                createdAt: createdBatch.createdAt,
                height: createdBatch.height,
                id: createdBatch.id,
                model: createdBatch.model,
                prompt: createdBatch.prompt,
                provider: createdBatch.provider,
                width: createdBatch.width,
              },
              createdGenerations,
              batch.config,
            ),
          },
          'recreateImage/addCreatedBatch',
        );
      }

      // 3. Refresh generation batches to show the real data
      await store.refreshGenerationBatches();
    } catch (error) {
      handleGenerationPromptModerationError(error);
      handleLobeHubModelDeprecatedError(error);
      handlePlatformProviderError(error);
      throw error;
    } finally {
      this.#set({ isCreating: false }, false, 'recreateImage/endCreateImage');
    }
  }
}

export type CreateImageAction = Pick<CreateImageActionImpl, keyof CreateImageActionImpl>;
