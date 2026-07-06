'use client';

import type { BuiltinInspectorProps, CrawlPluginState } from '@lobechat/types';
import { createStaticStyles, cx } from 'antd-style';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { highlightTextStyles, inspectorTextStyles, shinyTextStyles } from '@/styles';

const styles = createStaticStyles(({ css, cssVar }) => ({
  eventMeta: css`
    margin-inline-start: 8px;
    font-size: 12px;
    color: ${cssVar.colorTextQuaternary};
  `,
}));

interface CrawlSinglePageParams {
  url: string;
}

export const CrawlSinglePageInspector = memo<
  BuiltinInspectorProps<CrawlSinglePageParams, CrawlPluginState>
>(({ args, partialArgs, isArgumentsStreaming, isLoading, pluginState }) => {
  const { t } = useTranslation('plugin');

  const url = args?.url || partialArgs?.url;
  const resultCount = pluginState?.results?.length ?? 0;

  if (isArgumentsStreaming && !url) {
    return (
      <div className={cx(inspectorTextStyles.root, shinyTextStyles.shinyText)}>
        <span>{t('builtins.lobe-web-browsing.apiName.crawlSinglePage')}</span>
      </div>
    );
  }

  if (!isLoading && !isArgumentsStreaming && resultCount > 0) {
    return (
      <div className={inspectorTextStyles.root}>
        <span>{t('search.browsing.crawledPages', { count: resultCount })}</span>
        {url && <span className={styles.eventMeta}>{url}</span>}
      </div>
    );
  }

  return (
    <div
      className={cx(inspectorTextStyles.root, isArgumentsStreaming && shinyTextStyles.shinyText)}
    >
      <span>
        {t('builtins.lobe-web-browsing.apiName.crawlSinglePage')}:{'\u00A0'}
      </span>
      {url && <span className={highlightTextStyles.gold}>{url}</span>}
    </div>
  );
});

CrawlSinglePageInspector.displayName = 'CrawlSinglePageInspector';

export default CrawlSinglePageInspector;
