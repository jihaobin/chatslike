import type { CrawlResult } from '@lobechat/types';
import type { CrawlSuccessResult } from '@lobechat/web-crawler';
import {
  Alert,
  CopyButton,
  Flexbox,
  Highlighter,
  Icon,
  Markdown,
  stopPropagation,
  Text,
} from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { ExternalLink } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { CRAWL_CONTENT_LIMITED_COUNT } from '../../../const';

const styles = createStaticStyles(({ css, cssVar }) => {
  return {
    cardBody: css`
      padding-block: 12px 8px;
      padding-inline: 16px;
    `,
    container: css`
      cursor: pointer;

      overflow: hidden;

      max-width: 360px;
      border: 1px solid ${cssVar.colorBorderSecondary};
      border-radius: 12px;

      transition: border-color 0.2s;

      :hover {
        border-color: ${cssVar.colorPrimary};
      }
    `,
    description: css`
      margin-block: 0 4px !important;
      color: ${cssVar.colorTextSecondary};
    `,
    detailsSection: css`
      padding-block: ${cssVar.paddingSM};
    `,
    externalLink: css`
      color: ${cssVar.colorPrimary};
    `,
    footer: css`
      padding: ${cssVar.paddingXS};
      border-radius: 6px;
      text-align: center;
      background-color: ${cssVar.colorFillQuaternary};
    `,
    footerText: css`
      font-size: ${cssVar.fontSizeSM};
      color: ${cssVar.colorTextTertiary} !important;
    `,
    metaInfo: css`
      display: flex;
      align-items: center;
      color: ${cssVar.colorTextSecondary};
    `,
    title: css`
      overflow: hidden;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;

      margin-block-end: 0;

      font-size: 16px;
      font-weight: bold;
    `,
    titleRow: css`
      color: ${cssVar.colorText};
    `,

    url: css`
      color: ${cssVar.colorTextTertiary};
    `,
  };
});

interface PageContentProps {
  messageId: string;
  result?: CrawlResult;
}

const PageContent = memo<PageContentProps>(({ result }) => {
  const { t } = useTranslation('plugin');

  if (!result || !result.data) return undefined;

  if ('errorType' in result.data) {
    return (
      <Flexbox className={styles.footer} gap={4}>
        <div className={styles.footerText}>
          {t('search.crawPages.meta.crawler')}: {result.crawler}
        </div>
        <Alert
          type={'error'}
          extra={
            <div style={{ maxWidth: 500, overflowX: 'scroll' }}>
              <Highlighter language={'json'}>{JSON.stringify(result.data, null, 2)}</Highlighter>
            </div>
          }
          title={
            <div style={{ textAlign: 'start' }}>
              {result.data.errorMessage || result.data.content}
            </div>
          }
        />
      </Flexbox>
    );
  }

  const { url, title, description, content, siteName } = result.data as CrawlSuccessResult;
  return (
    <Flexbox gap={24}>
      <Flexbox gap={8}>
        <Flexbox
          horizontal
          align={'center'}
          className={styles.titleRow}
          gap={24}
          justify={'space-between'}
        >
          <Flexbox>
            <div className={styles.title}>{title || result.originalUrl}</div>
          </Flexbox>
        </Flexbox>
        {description && (
          <Text className={styles.description} ellipsis={{ rows: 4 }}>
            {description}
          </Text>
        )}
        <Flexbox horizontal align={'center'} className={styles.url} gap={4}>
          {siteName && <div>{siteName} · </div>}
          <a
            className={styles.url}
            href={url}
            rel={'nofollow'}
            style={{ display: 'flex', gap: 4 }}
            target={'_blank'}
            onClick={stopPropagation}
          >
            {result.originalUrl}
            <Icon icon={ExternalLink} />
          </a>
        </Flexbox>
      </Flexbox>
      {content && (
        <Flexbox gap={12} paddingBlock={'0 12px'}>
          <Flexbox horizontal justify={'flex-end'}>
            <CopyButton content={content} />
          </Flexbox>
          {content.length > CRAWL_CONTENT_LIMITED_COUNT && (
            <Alert
              variant={'borderless'}
              title={t('search.crawPages.detail.tooLong', {
                characters: CRAWL_CONTENT_LIMITED_COUNT,
              })}
            />
          )}
          <Markdown variant={'chat'}>{content}</Markdown>
        </Flexbox>
      )}
    </Flexbox>
  );
});

export default PageContent;
