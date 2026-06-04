'use client';

import { Alert } from '@lobehub/ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { aiProviderSelectors, useAiInfraStore } from '@/store/aiInfra';

const ProviderScopeBanner = memo(() => {
  const { t } = useTranslation('modelProvider');
  const isGlobalScope = useAiInfraStore(aiProviderSelectors.isGlobalProviderConfigScope);

  if (!isGlobalScope) return null;

  return (
    <Alert
      closable={false}
      description={t('providerScope.global.desc')}
      message={t('providerScope.global.title')}
      type="info"
    />
  );
});

ProviderScopeBanner.displayName = 'ProviderScopeBanner';

export default ProviderScopeBanner;
