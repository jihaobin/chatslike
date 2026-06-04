import {
  type AiModelSortMap,
  type AiProviderModelListItem,
  type CreateAiModelParams,
  isAiModelVisible,
  type ToggleAiModelEnableParams,
  type UpdateAiModelParams,
} from 'model-bank';

import { lambdaClient } from '@/libs/trpc/client';
import { type ProviderScopeParams } from '@/services/aiProvider';

export interface GetAiProviderModelListParams extends ProviderScopeParams {
  enabled?: boolean;
  limit?: number;
  offset?: number;
}

type CreateScopedAiModelParams = CreateAiModelParams & ProviderScopeParams;
type ToggleScopedAiModelEnableParams = ToggleAiModelEnableParams & ProviderScopeParams;

export class AiModelService {
  createAiModel = async (params: CreateScopedAiModelParams) => {
    return lambdaClient.aiModel.createAiModel.mutate(params);
  };

  getAiProviderModelList = async (
    id: string,
    params?: GetAiProviderModelListParams,
  ): Promise<AiProviderModelListItem[]> => {
    const models = await lambdaClient.aiModel.getAiProviderModelList.query({ id, ...params });
    return models.filter(isAiModelVisible);
  };

  getAiModelById = async (id: string, params?: ProviderScopeParams) => {
    return lambdaClient.aiModel.getAiModelById.query({ id, ...params });
  };

  toggleModelEnabled = async (params: ToggleScopedAiModelEnableParams) => {
    return lambdaClient.aiModel.toggleModelEnabled.mutate(params);
  };

  updateAiModel = async (
    id: string,
    providerId: string,
    value: UpdateAiModelParams,
    params?: ProviderScopeParams,
  ) => {
    return lambdaClient.aiModel.updateAiModel.mutate({ id, providerId, value, ...params });
  };

  batchUpdateAiModels = async (
    id: string,
    models: AiProviderModelListItem[],
    params?: ProviderScopeParams,
  ) => {
    return lambdaClient.aiModel.batchUpdateAiModels.mutate({ id, models, ...params });
  };

  batchToggleAiModels = async (
    id: string,
    models: string[],
    enabled: boolean,
    params?: ProviderScopeParams,
  ) => {
    return lambdaClient.aiModel.batchToggleAiModels.mutate({ enabled, id, models, ...params });
  };

  clearModelsByProvider = async (providerId: string, params?: ProviderScopeParams) => {
    return lambdaClient.aiModel.clearModelsByProvider.mutate({ providerId, ...params });
  };

  clearRemoteModels = async (providerId: string, params?: ProviderScopeParams) => {
    return lambdaClient.aiModel.clearRemoteModels.mutate({ providerId, ...params });
  };

  updateAiModelOrder = async (
    providerId: string,
    items: AiModelSortMap[],
    params?: ProviderScopeParams,
  ) => {
    return lambdaClient.aiModel.updateAiModelOrder.mutate({ providerId, sortMap: items, ...params });
  };

  deleteAiModel = async (params: { id: string; providerId: string } & ProviderScopeParams) => {
    return lambdaClient.aiModel.removeAiModel.mutate(params);
  };
}

export const aiModelService = new AiModelService();
