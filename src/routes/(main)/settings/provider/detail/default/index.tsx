'use client';

import { Flexbox } from '@lobehub/ui';
import { memo } from 'react';

import { useAiInfraStore } from '@/store/aiInfra';
import { featureFlagsSelectors, useServerConfigStore } from '@/store/serverConfig';

import ModelList from '../../features/ModelList';
import { type ProviderConfigProps } from '../../features/ProviderConfig';
import ProviderConfig from '../../features/ProviderConfig';

interface ProviderDetailProps extends ProviderConfigProps {
  showConfig?: boolean;
}
const ProviderDetail = memo<ProviderDetailProps>(({ showConfig = true, ...card }) => {
  const useFetchAiProviderItem = useAiInfraStore((s) => s.useFetchAiProviderItem);
  const useFetchAiProviderList = useAiInfraStore((s) => s.useFetchAiProviderList);
  const isMobile = useServerConfigStore((s) => s.isMobile);
  const hideProviderTemplates = useServerConfigStore(featureFlagsSelectors)?.hideProviderTemplates;

  // The sidebar menu normally fetches the provider list. It is hidden on mobile and when
  // templates are hidden, so fetch here in those cases (SWR dedupes when already loaded).
  useFetchAiProviderList({ enabled: isMobile || !!hideProviderTemplates });
  useFetchAiProviderItem(card.id);

  return (
    <Flexbox gap={24} paddingBlock={8}>
      {showConfig && <ProviderConfig {...card} />}
      <ModelList id={card.id} {...card.settings} />
    </Flexbox>
  );
});

export default ProviderDetail;
