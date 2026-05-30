import { toast } from '@lobehub/ui';
import { useTranslation } from 'react-i18next';

import {
  isPlatformBillingEnabled,
  isPlatformHostedProvider,
} from '@/business/shared/platformModels';

export interface BusinessModelListGuard {
  isModelRestricted?: (modelId: string, providerId: string) => boolean;
  onRestrictedModelClick?: () => void;
}

export const useBusinessModelListGuard = (): BusinessModelListGuard => {
  const { t } = useTranslation('subscription');

  if (!isPlatformBillingEnabled()) return {};

  return {
    isModelRestricted: (_modelId, providerId) => !isPlatformHostedProvider(providerId),
    onRestrictedModelClick: () => {
      toast.info(
        t('billingNative.platformModels.onlyHosted', 'Only platform hosted models are available'),
      );
    },
  };
};
