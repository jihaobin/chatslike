import type { CrawlPluginState } from '@lobechat/types';
import type { CrawlErrorResult } from '@lobechat/web-crawler';
import { Flexbox } from '@lobehub/ui';
import { FileText } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { WebBrowsingEvent } from '../../components';
import Loading from './Loading';
import Result from './Result';

interface PagesContentProps {
  messageId: string;
  results?: CrawlPluginState['results'];
  urls?: string[];
}

const PagesContent = memo<PagesContentProps>(({ results, messageId, urls = [] }) => {
  const { t } = useTranslation('plugin');

  if (!results || results.length === 0) {
    return (
      <WebBrowsingEvent iconLabel={<FileText size={12} />} title={t('search.browsing.readingPage')}>
        <Flexbox gap={3} style={{ marginInlineStart: 26 }}>
          {urls.map((url, index) => (
            <Loading key={`${url}_${index}`} url={url} />
          ))}
        </Flexbox>
      </WebBrowsingEvent>
    );
  }

  return (
    <WebBrowsingEvent
      iconLabel={<FileText size={12} />}
      title={t('search.browsing.crawledPages', { count: results.length })}
    >
      <Flexbox gap={5} style={{ marginInlineStart: 26 }}>
        {results.slice(0, 4).map((result) => (
          <Result
            crawler={result.crawler}
            key={result.originalUrl}
            messageId={messageId}
            originalUrl={result.originalUrl}
            result={
              result.data ||
              // TODO: Remove this in v2 as it's deprecated
              ({
                content: (result as any)?.content,
                errorMessage: (result as any)?.errorMessage,
                errorType: (result as any)?.errorType,
                url: result.originalUrl,
              } as CrawlErrorResult)
            }
          />
        ))}
      </Flexbox>
    </WebBrowsingEvent>
  );
});

export default PagesContent;
