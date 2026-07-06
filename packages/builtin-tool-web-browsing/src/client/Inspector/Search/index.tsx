'use client';

import type { BuiltinInspectorProps, SearchQuery, UniformSearchResponse } from '@lobechat/types';
import { Flexbox, Text } from '@lobehub/ui';
import { createStaticStyles, cssVar, cx } from 'antd-style';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { highlightTextStyles, inspectorTextStyles, shinyTextStyles } from '@/styles';

import { SourceAvatarCluster } from '../../components';

const styles = createStaticStyles(({ css, cssVar }) => ({
  eventRoot: css`
    overflow: hidden;
    min-width: 0;
  `,
  eventMeta: css`
    overflow: hidden;

    margin-inline-start: 8px;

    font-size: 12px;
    color: ${cssVar.colorTextQuaternary};
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  eventTitle: css`
    white-space: nowrap;
  `,
}));

export const SearchInspector = memo<BuiltinInspectorProps<SearchQuery, UniformSearchResponse>>(
  ({ args, partialArgs, isArgumentsStreaming, isLoading, pluginState }) => {
    const { t } = useTranslation('plugin');

    const query = args?.query || partialArgs?.query || '';
    const resultCount = pluginState?.results?.length ?? 0;
    const hasResults = resultCount > 0;
    const sources = pluginState?.results?.flatMap((result) => result.engines || []) || [];

    if (isArgumentsStreaming && !query) {
      return (
        <div className={cx(inspectorTextStyles.root, shinyTextStyles.shinyText)}>
          <span>{t('builtins.lobe-web-browsing.apiName.search')}</span>
        </div>
      );
    }

    if (!isLoading && !isArgumentsStreaming && pluginState?.results) {
      return (
        <Flexbox
          horizontal
          align="center"
          className={cx(inspectorTextStyles.root, styles.eventRoot)}
          gap={8}
        >
          {hasResults ? (
            <>
              <span className={styles.eventTitle}>
                {t('search.browsing.webResults', { count: resultCount })}
              </span>
              <SourceAvatarCluster max={3} sources={sources} />
            </>
          ) : (
            <Text as={'span'} color={cssVar.colorTextDescription} fontSize={12}>
              {t('builtins.lobe-web-browsing.inspector.noResults')}
            </Text>
          )}
          {query && <span className={styles.eventMeta}>{query}</span>}
        </Flexbox>
      );
    }

    return (
      <div
        className={cx(
          inspectorTextStyles.root,
          (isArgumentsStreaming || isLoading) && shinyTextStyles.shinyText,
        )}
      >
        <span>
          {t('builtins.lobe-web-browsing.apiName.search')}:{'\u00A0'}
        </span>
        {query && <span className={highlightTextStyles.primary}>{query}</span>}
      </div>
    );
  },
);

SearchInspector.displayName = 'SearchInspector';

export default SearchInspector;
