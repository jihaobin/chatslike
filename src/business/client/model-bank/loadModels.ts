import { loadModels as loadBusinessModels } from '@lobechat/business-model-bank/model-config';

import { commercialRuntime } from '@/business/shared/commercialRuntime';
import { isPlatformHostedProvider } from '@/business/shared/platformModels';

export const loadModels = async () => {
  const models = await loadBusinessModels();

  if (!commercialRuntime.platformHostedModels.enabled) return models;

  return models.filter((model) => isPlatformHostedProvider(model.providerId));
};
