'use client';

import { Flexbox, Grid, Tag, Text } from '@lobehub/ui';
import isEqual from 'fast-deep-equal';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';

import { aiProviderSelectors, useAiInfraStore } from '@/store/aiInfra';
import { featureFlagsSelectors, useServerConfigStore } from '@/store/serverConfig';
import { AiProviderSourceEnum } from '@/types/aiProvider';

import AddNew from '../../ProviderMenu/AddNew';
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

  // With templates hidden, redirect to the first relevant enabled provider.
  // In global scope, only redirect when there are enabled *custom* providers —
  // otherwise show the grid so admins can add their first custom provider.
  const redirectList = isGlobalScope
    ? enabledList.filter((item) => item.source === AiProviderSourceEnum.Custom)
    : enabledList;
  if (hideProviderTemplates && redirectList.length > 0) {
    const prefix = `/settings/provider/${isGlobalScope ? 'global/' : ''}`;
    return <Navigate replace to={`${prefix}${redirectList[0].id}`} />;
  }

  return (
    <>
      <Flexbox gap={24}>
        <Flexbox horizontal align={'center'} gap={8}>
          <Text strong style={{ fontSize: 18 }}>
            {t('list.title.enabled')}
          </Text>
          <Tag>{enabledList.length}</Tag>
          {isGlobalScope && hideProviderTemplates && <AddNew />}
        </Flexbox>
        <Grid gap={16} rows={3}>
          {enabledList.map((item) => (
            <Card {...item} key={item.id} onProviderSelect={onProviderSelect} />
          ))}
        </Grid>
      </Flexbox>
      {(!hideProviderTemplates || isGlobalScope) && disabledCustomList.length > 0 && (
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
