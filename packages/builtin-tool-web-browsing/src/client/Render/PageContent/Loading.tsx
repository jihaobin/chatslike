'use client';

import { Flexbox, Skeleton } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

const styles = createStaticStyles(({ css, cssVar }) => ({
  text: css`
    font-size: 12px;
    color: ${cssVar.colorTextQuaternary};
  `,
  url: css`
    width: fit-content;
    max-width: 100%;

    color: ${cssVar.colorTextSecondary};
    text-decoration: underline;
    text-underline-offset: 2px;

    &:hover {
      color: ${cssVar.colorText};
    }
  `,
}));

const LoadingRow = memo<{ url: string }>(({ url }) => {
  const { t } = useTranslation('plugin');

  return (
    <Flexbox gap={4}>
      <a className={styles.url} href={url} rel="noreferrer" target="_blank">
        {url}
      </a>
      <Flexbox horizontal align="center" gap={6}>
        <Skeleton.Block active style={{ height: 12, width: 120 }} />
        <span className={styles.text}>{t('search.crawPages.crawling')}</span>
      </Flexbox>
    </Flexbox>
  );
});

LoadingRow.displayName = 'LoadingRow';

export default LoadingRow;
