import { loadModels as loadBusinessModels } from '@lobechat/business-model-bank/model-config';

import {
  isPlatformBillingEnabled,
  isPlatformHostedProvider,
} from '@/business/shared/platformModels';

export const loadModels = async () => {
  const models = await loadBusinessModels();

  if (!isPlatformBillingEnabled()) return models;

  return models.filter((model) => isPlatformHostedProvider(model.providerId));
};
