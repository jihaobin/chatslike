import { lambdaClient } from '@/libs/trpc/client';
import {
  type AiProviderDetailItem,
  type AiProviderRuntimeState,
  type AiProviderSortMap,
  type CreateAiProviderParams,
  type UpdateAiProviderConfigParams,
  type UpdateAiProviderParams,
} from '@/types/aiProvider';

export interface ProviderScopeParams {
  scope?: 'user' | 'global';
}

export class AiProviderService {
  createAiProvider = async (params: CreateAiProviderParams & ProviderScopeParams) => {
    return lambdaClient.aiProvider.createAiProvider.mutate(params);
  };

  getAiProviderList = async (params?: ProviderScopeParams) => {
    return lambdaClient.aiProvider.getAiProviderList.query(params);
  };

  getAiProviderById = async (
    id: string,
    params?: ProviderScopeParams,
  ): Promise<AiProviderDetailItem | undefined> => {
    return lambdaClient.aiProvider.getAiProviderById.query({ id, ...params });
  };

  toggleProviderEnabled = async (id: string, enabled: boolean, params?: ProviderScopeParams) => {
    return lambdaClient.aiProvider.toggleProviderEnabled.mutate({ enabled, id, ...params });
  };

  updateAiProvider = async (
    id: string,
    value: UpdateAiProviderParams,
    params?: ProviderScopeParams,
  ) => {
    return lambdaClient.aiProvider.updateAiProvider.mutate({ id, value, ...params });
  };

  updateAiProviderConfig = async (
    id: string,
    value: UpdateAiProviderConfigParams,
    params?: ProviderScopeParams,
  ) => {
    return lambdaClient.aiProvider.updateAiProviderConfig.mutate({ id, value, ...params });
  };

  updateAiProviderOrder = async (items: AiProviderSortMap[], params?: ProviderScopeParams) => {
    return lambdaClient.aiProvider.updateAiProviderOrder.mutate({ sortMap: items, ...params });
  };

  deleteAiProvider = async (id: string, params?: ProviderScopeParams) => {
    return lambdaClient.aiProvider.removeAiProvider.mutate({ id, ...params });
  };

  getAiProviderRuntimeState = async (
    isLogin?: boolean,
    params?: ProviderScopeParams,
  ): Promise<AiProviderRuntimeState> => {
    return lambdaClient.aiProvider.getAiProviderRuntimeState.query({ isLogin, ...params });
  };
}

export const aiProviderService = new AiProviderService();
