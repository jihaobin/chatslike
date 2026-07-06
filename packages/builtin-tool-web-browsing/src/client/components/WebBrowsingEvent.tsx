'use client';

import { Button, Flexbox } from '@lobehub/ui';
import { createStaticStyles, cx } from 'antd-style';
import type { ReactNode } from 'react';
import { memo } from 'react';

const styles = createStaticStyles(({ css, cssVar }) => ({
  avatar: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;

    width: 18px;
    height: 18px;
    margin-inline-start: -4px;
    border: 1px solid ${cssVar.colorBgContainer};
    border-radius: 50%;

    font-size: 10px;
    line-height: 18px;
    color: ${cssVar.colorTextSecondary};

    background: ${cssVar.colorFillQuaternary};

    &:first-child {
      margin-inline-start: 0;
    }
  `,
  event: css`
    min-width: 0;
    font-size: 13px;
    line-height: 1.65;
    color: ${cssVar.colorTextSecondary};
  `,
  eventHeader: css`
    width: fit-content;
    max-width: 100%;
    padding-block: 3px;
    padding-inline: 6px 9px;
    border-radius: 999px;

    background: ${cssVar.colorFillQuaternary};
  `,
  icon: css`
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;

    width: 18px;
    height: 18px;
    border-radius: 999px;

    color: ${cssVar.colorTextTertiary};
  `,
  link: css`
    width: fit-content;
    max-width: 100%;

    color: ${cssVar.colorTextSecondary};
    text-decoration: underline;
    text-underline-offset: 2px;

    &:hover {
      color: ${cssVar.colorText};
    }
  `,
  linkButton: css`
    cursor: pointer;

    padding: 0;
    border: 0;

    font: inherit;
    text-align: start;

    background: transparent;
  `,
  list: css`
    margin-inline-start: 26px;
    padding-block: 1px;
  `,
  title: css`
    min-width: 0;
    color: ${cssVar.colorTextSecondary};
  `,
}));

const palette = ['#eef2ff', '#fff7ed', '#ecfdf5', '#fef2f2', '#f5f3ff'];

const getSourceInitial = (source: string) => {
  const trimmed = source.trim();
  if (!trimmed) return '?';
  return trimmed[0]!.toUpperCase();
};

export interface SourceAvatarClusterProps {
  max?: number;
  sources: string[];
}

export const SourceAvatarCluster = memo<SourceAvatarClusterProps>(({ sources, max = 4 }) => {
  const visible = [...new Set(sources.filter(Boolean))].slice(0, max);
  if (visible.length === 0) return null;

  return (
    <Flexbox horizontal align="center" gap={0}>
      {visible.map((source, index) => (
        <span
          aria-label={source}
          className={styles.avatar}
          key={source}
          style={{ background: palette[index % palette.length] }}
          title={source}
        >
          {getSourceInitial(source)}
        </span>
      ))}
    </Flexbox>
  );
});

SourceAvatarCluster.displayName = 'SourceAvatarCluster';

export interface WebBrowsingLinkItem {
  onClick?: () => void;
  title: string;
  url?: string;
}

export interface WebBrowsingLinkListProps {
  items: WebBrowsingLinkItem[];
}

export const WebBrowsingLinkList = memo<WebBrowsingLinkListProps>(({ items }) => {
  if (items.length === 0) return null;

  return (
    <Flexbox className={styles.list} gap={3}>
      {items.map((item) =>
        item.url ? (
          <a
            className={styles.link}
            href={item.url}
            key={`${item.title}-${item.url}`}
            rel="noreferrer"
            target="_blank"
            onClick={item.onClick}
          >
            {item.title}
          </a>
        ) : (
          <button
            className={cx(styles.link, styles.linkButton)}
            key={item.title}
            type="button"
            onClick={item.onClick}
          >
            {item.title}
          </button>
        ),
      )}
    </Flexbox>
  );
});

WebBrowsingLinkList.displayName = 'WebBrowsingLinkList';

export interface WebBrowsingEventProps {
  children?: ReactNode;
  iconLabel: ReactNode;
  onShowMore?: () => void;
  showMoreLabel?: string;
  sources?: string[];
  title: ReactNode;
}

export const WebBrowsingEvent = memo<WebBrowsingEventProps>(
  ({ children, iconLabel, onShowMore, showMoreLabel, sources = [], title }) => (
    <Flexbox className={styles.event} gap={5}>
      <Flexbox horizontal align="center" className={styles.eventHeader} gap={8}>
        <span className={styles.icon}>{iconLabel}</span>
        <span className={styles.title}>{title}</span>
        <SourceAvatarCluster sources={sources} />
      </Flexbox>
      {children}
      {onShowMore && showMoreLabel && (
        <Button
          color="default"
          size="small"
          style={{ marginInlineStart: 26, width: 'fit-content' }}
          variant="filled"
          onClick={onShowMore}
        >
          {showMoreLabel}
        </Button>
      )}
    </Flexbox>
  ),
);

WebBrowsingEvent.displayName = 'WebBrowsingEvent';
