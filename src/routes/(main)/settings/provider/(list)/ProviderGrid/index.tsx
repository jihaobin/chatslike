'use client';

import { Flexbox, Grid, Tag, Text } from '@lobehub/ui';
import isEqual from 'fast-deep-equal';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';

import { aiProviderSelectors, useAiInfraStore } from '@/store/aiInfra';
import { featureFlagsSelectors, useServerConfigStore } from '@/store/serverConfig';

import Card from './Card';

const loadingArr = Array.from({ length: 12 })
  .fill('-')
  .map((item, index) => `${index}x${item}`);

type ListProps = {
  onProviderSelect: (provider: string) => void;
};

const List = memo((props: ListProps) => {
  const { onProviderSelect } = props;
  const { t } = useTranslation('modelProvider');
  const enabledList = useAiInfraStore(aiProviderSelectors.enabledAiProviderList, isEqual);
  const disabledList = useAiInfraStore(aiProviderSelectors.disabledAiProviderList, isEqual);
  const disabledCustomList = useAiInfraStore(
    aiProviderSelectors.disabledCustomAiProviderList,
    isEqual,
  );
  const [initAiProviderList] = useAiInfraStore((s) => [s.initAiProviderList]);
  const useFetchAiProviderList = useAiInfraStore((s) => s.useFetchAiProviderList);
  const isGlobalScope = useAiInfraStore(aiProviderSelectors.isGlobalProviderConfigScope);
  const hideProviderTemplates = useServerConfigStore(featureFlagsSelectors)?.hideProviderTemplates;

  // When templates are hidden the provider sidebar menu (the usual fetch trigger) is
  // not rendered, so the grid must fetch the list itself. SWR dedupes by key, so this
  // is a no-op when the menu is present (flag off).
  useFetchAiProviderList({ enabled: !!hideProviderTemplates });

  if (!initAiProviderList)
    return (
      <Flexbox gap={24} paddingBlock={'0 16px'}>
        <Flexbox horizontal align={'center'} gap={4}>
          <Text strong style={{ fontSize: 16 }}>
            {t('list.title.enabled')}
          </Text>
        </Flexbox>
        <Grid gap={16} rows={3}>
          {loadingArr.map((item) => (
            <Card
              loading
              enabled={false}
              id={item}
              key={item}
              source={'builtin'}
              onProviderSelect={onProviderSelect}
            />
          ))}
        </Grid>
      </Flexbox>
    );

  // With templates hidden, this grid is only a fallback for the empty state. Many entry
  // points still link straight to `/all`, so land them on the first enabled provider here
  // (the smart redirect at the index route can't cover those hard-coded links).
  if (hideProviderTemplates && enabledList.length > 0) {
    const prefix = `/settings/provider/${isGlobalScope ? 'global/' : ''}`;
    return <Navigate replace to={`${prefix}${enabledList[0].id}`} />;
  }

  return (
    <>
      <Flexbox gap={24}>
        <Flexbox horizontal align={'center'} gap={8}>
          <Text strong style={{ fontSize: 18 }}>
            {t('list.title.enabled')}
          </Text>
          <Tag>{enabledList.length}</Tag>
        </Flexbox>
        <Grid gap={16} rows={3}>
          {enabledList.map((item) => (
            <Card {...item} key={item.id} onProviderSelect={onProviderSelect} />
          ))}
        </Grid>
      </Flexbox>
      {!hideProviderTemplates && disabledCustomList.length > 0 && (
        <Flexbox gap={24}>
          <Flexbox horizontal align={'center'} gap={8}>
            <Text strong style={{ fontSize: 18 }}>
              {t('list.title.custom')}
            </Text>
            <Tag>{disabledCustomList.length}</Tag>
          </Flexbox>
          <Grid gap={16} rows={3}>
            {disabledCustomList.map((item) => (
              <Card {...item} key={item.id} onProviderSelect={onProviderSelect} />
            ))}
          </Grid>
        </Flexbox>
      )}
      {!hideProviderTemplates && (
        <Flexbox gap={24}>
          <Flexbox horizontal align={'center'} gap={8}>
            <Text strong style={{ fontSize: 18 }}>
              {t('list.title.disabled')}
            </Text>
            <Tag>{disabledList.length}</Tag>
          </Flexbox>
          <Grid gap={16} rows={3}>
            {disabledList.map((item) => (
              <Card {...item} key={item.id} onProviderSelect={onProviderSelect} />
            ))}
          </Grid>
        </Flexbox>
      )}
    </>
  );
});

export default List;
