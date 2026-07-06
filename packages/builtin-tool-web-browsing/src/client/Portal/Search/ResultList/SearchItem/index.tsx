import type { UniformSearchResult } from '@lobechat/types';
import { Flexbox } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { memo } from 'react';

import WebFavicon from '@/components/WebFavicon';

import Video from './Video';

const styles = createStaticStyles(({ css, cssVar }) => {
  return {
    container: css`
      display: block;

      padding-block: 10px;
      padding-inline: 12px;
      border-radius: 8px;

      color: inherit;

      &:hover {
        background: ${cssVar.colorFillQuaternary};
      }
    `,
    desc: css`
      overflow: hidden;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;

      font-size: 13px;
      line-height: 1.5;
      color: ${cssVar.colorTextSecondary};
    `,
    meta: css`
      font-size: 12px;
      color: ${cssVar.colorTextTertiary};
    `,
    title: css`
      font-size: 15px;
      font-weight: 600;
      line-height: 1.45;
      color: ${cssVar.colorText};
    `,
  };
});

interface SearchResultProps extends UniformSearchResult {
  highlight?: boolean;
}

const SearchItem = memo<SearchResultProps>((props) => {
  const { content, url, engines, title, category, publishedDate } = props as SearchResultProps & {
    publishedDate?: string;
  };

  if (category === 'videos') return <Video {...props} />;

  const source = engines?.[0] || (url ? new URL(url).hostname.replace('www.', '') : '');

  return (
    <a className={styles.container} href={url!} rel="noreferrer" target={'_blank'}>
      <Flexbox gap={6}>
        <Flexbox horizontal align="center" className={styles.meta} gap={6}>
          <WebFavicon size={16} title={title} url={url} />
          <span>{source}</span>
          {publishedDate && (
            <>
              <span>丨</span>
              <span>{publishedDate}</span>
            </>
          )}
        </Flexbox>
        <div className={styles.title}>{title}</div>
        {content && <div className={styles.desc}>{content}</div>}
      </Flexbox>
    </a>
  );
});

export default SearchItem;
