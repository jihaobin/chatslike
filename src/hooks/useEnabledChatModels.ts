import isEqual from 'fast-deep-equal';

import { useAiInfraStore } from '@/store/aiInfra';
import { type EnabledProviderWithModels } from '@/types/aiProvider';

export const getFirstEnabledChatModel = (enabledList: EnabledProviderWithModels[]) => {
  for (const providerItem of enabledList) {
    const modelItem = providerItem.children[0];
    if (modelItem) return { model: modelItem.id, provider: providerItem.id };
  }
};

export const getEffectiveChatModel = (
  enabledList: EnabledProviderWithModels[],
  model?: string,
  provider?: string,
) => {
  const enabledModel = enabledList
    .flatMap((providerItem) =>
      providerItem.children.map((modelItem) => ({ model: modelItem.id, provider: providerItem.id })),
    )
    .find((item) => item.model === model && item.provider === provider);

  return enabledModel ?? getFirstEnabledChatModel(enabledList);
};

export const useEnabledChatModels = (): EnabledProviderWithModels[] => {
  const enabledChatModelList = useAiInfraStore((s) => s.enabledChatModelList, isEqual);

  return enabledChatModelList || [];
};
