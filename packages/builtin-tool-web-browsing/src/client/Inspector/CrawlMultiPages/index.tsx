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

interface CrawlMultiPagesParams {
  urls: string[];
}

export const CrawlMultiPagesInspector = memo<
  BuiltinInspectorProps<CrawlMultiPagesParams, CrawlPluginState>
>(({ args, partialArgs, isArgumentsStreaming, isLoading, pluginState }) => {
  const { t } = useTranslation('plugin');

  const urls = args?.urls || partialArgs?.urls;
  const resultCount = pluginState?.results?.length ?? 0;

  // Show count and first domain for context
  let displayText = '';
  if (urls && urls.length > 0) {
    const count = urls.length;
    try {
      const firstUrl = new URL(urls[0]);
      displayText = count > 1 ? `${firstUrl.hostname} +${count - 1}` : firstUrl.hostname;
    } catch {
      displayText = `${count} pages`;
    }
  }

  if (isArgumentsStreaming && !displayText) {
    return (
      <div className={cx(inspectorTextStyles.root, shinyTextStyles.shinyText)}>
        <span>{t('builtins.lobe-web-browsing.apiName.crawlMultiPages')}</span>
      </div>
    );
  }

  if (!isLoading && !isArgumentsStreaming && resultCount > 0) {
    return (
      <div className={inspectorTextStyles.root}>
        <span>{t('search.browsing.crawledPages', { count: resultCount })}</span>
        {displayText && <span className={styles.eventMeta}>{displayText}</span>}
      </div>
    );
  }

  return (
    <div
      className={cx(inspectorTextStyles.root, isArgumentsStreaming && shinyTextStyles.shinyText)}
    >
      <span>
        {t('builtins.lobe-web-browsing.apiName.crawlMultiPages')}:{'\u00A0'}
      </span>
      {displayText && <span className={highlightTextStyles.gold}>{displayText}</span>}
    </div>
  );
});

CrawlMultiPagesInspector.displayName = 'CrawlMultiPagesInspector';

export default CrawlMultiPagesInspector;
