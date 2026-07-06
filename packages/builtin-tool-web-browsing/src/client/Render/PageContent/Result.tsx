'use client';

import type { CrawlErrorResult, CrawlSuccessResult } from '@lobechat/web-crawler';
import { Alert, Flexbox, stopPropagation } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { useChatStore } from '@/store/chat';

import { WebBrowsingManifest } from '../../../manifest';

const styles = createStaticStyles(({ css, cssVar }) => {
  return {
    error: css`
      width: fit-content;
      max-width: 100%;
      padding-block: 4px;
      padding-inline: 8px;
    `,
    externalLink: css`
      width: fit-content;

      font-size: 12px;
      color: ${cssVar.colorTextQuaternary};
      text-decoration: underline;
      text-underline-offset: 2px;

      :hover {
        color: ${cssVar.colorText};
      }
    `,
    rowButton: css`
      cursor: pointer;

      display: grid;
      gap: 2px;

      width: fit-content;
      max-width: 100%;
      padding: 0;
      border: 0;

      font: inherit;
      color: ${cssVar.colorTextSecondary};
      text-align: start;

      background: transparent;

      &:hover {
        color: ${cssVar.colorText};
      }
    `,
    rowDescription: css`
      overflow: hidden;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 1;

      font-size: 12px;
      color: ${cssVar.colorTextQuaternary};
    `,
    rowTitle: css`
      color: ${cssVar.colorTextSecondary};
      text-decoration: underline;
      text-underline-offset: 2px;
    `,
  };
});

interface CrawlerData {
  crawler: string;
  messageId: string;
  originalUrl: string;
  result: CrawlSuccessResult | CrawlErrorResult;
}

const CrawlerResultCard = memo<CrawlerData>(({ result, messageId, originalUrl }) => {
  const { t } = useTranslation('plugin');
  const [openToolUI, togglePageContent] = useChatStore((s) => [s.openToolUI, s.togglePageContent]);

  if ('errorType' in result) {
    return (
      <Flexbox gap={4}>
        <Alert
          className={styles.error}
          title={<div style={{ textAlign: 'start' }}>{result.errorMessage || result.content}</div>}
          type={'error'}
          variant={'borderless'}
        />
      </Flexbox>
    );
  }

  const { url, title, description } = result as CrawlSuccessResult;

  return (
    <Flexbox gap={3}>
      <button
        className={styles.rowButton}
        type="button"
        onClick={() => {
          openToolUI(messageId, WebBrowsingManifest.identifier);
          togglePageContent(originalUrl);
        }}
      >
        <span className={styles.rowTitle}>{title || originalUrl}</span>
        {description && <span className={styles.rowDescription}>{description}</span>}
      </button>
      <a
        className={styles.externalLink}
        href={url}
        rel="noreferrer"
        target="_blank"
        onClick={stopPropagation}
      >
        {t('search.browsing.openOriginal')} ↗
      </a>
    </Flexbox>
  );
});

export default CrawlerResultCard;
