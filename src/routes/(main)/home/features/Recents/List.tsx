import { Flexbox, Text } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import dayjs from 'dayjs';
import { memo, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import SkeletonList from '@/features/NavPanel/components/SkeletonList';
import { useHomeStore } from '@/store/home';
import { homeRecentSelectors } from '@/store/home/selectors';
import { useServerConfigStore } from '@/store/serverConfig';
import { featureFlagsSelectors } from '@/store/serverConfig/selectors';

import RecentListItem from './Item';
import { resolveHomeRecentRoutePath } from './routePath';

const SCROLL_LOAD_THRESHOLD = 48;

const styles = createStaticStyles(({ css, cssVar }) => ({
  groupTitle: css`
    padding: 10px 8px 4px;
    font-size: 12px;
    font-weight: 500;
    color: ${cssVar.colorTextDescription};
  `,
  list: css`
    padding-block-end: 4px;
  `,
  sentinel: css`
    height: 16px;
    flex: none;
  `,
}));

const getRecentGroupId = (updatedAt: Date): string => {
  const date = dayjs(updatedAt);
  const now = dayjs();

  if (date.isSame(now, 'day')) return 'today';
  if (date.isSame(now.subtract(1, 'day'), 'day')) return 'yesterday';
  if (date.isAfter(now.subtract(7, 'day').startOf('day'))) return 'week';
  if (date.isAfter(now.subtract(30, 'day').startOf('day'))) return 'thirtyDays';

  return date.format('YYYY-MM');
};

const RecentsList = memo(() => {
  const { t } = useTranslation('common');
  const recents = useHomeStore(homeRecentSelectors.recents);
  const hasMoreRecents = useHomeStore(homeRecentSelectors.hasMoreRecents);
  const isInit = useHomeStore(homeRecentSelectors.isRecentsInit);
  const loadMoreRecents = useHomeStore((s) => s.loadMoreRecents);
  const hideAgentManagement = useServerConfigStore(featureFlagsSelectors)?.hideAgentManagement;

  const groupedRecents = useMemo(() => {
    const getRecentGroupLabel = (id: string) => {
      switch (id) {
        case 'today': {
          return t('time.today');
        }
        case 'yesterday': {
          return t('time.yesterday');
        }
        case 'week': {
          return t('navPanel.recents.week');
        }
        case 'thirtyDays': {
          return t('navPanel.recents.thirtyDays');
        }
        default: {
          return id;
        }
      }
    };

    const groups = new Map<string, typeof recents>();

    for (const item of [...recents].sort(
      (a, b) => dayjs(b.updatedAt).valueOf() - dayjs(a.updatedAt).valueOf(),
    )) {
      const id = getRecentGroupId(item.updatedAt);
      const items = groups.get(id);
      if (items) {
        items.push(item);
      } else {
        groups.set(id, [item]);
      }
    }

    return Array.from(groups.entries()).map(([id, items]) => ({
      id,
      items,
      label: getRecentGroupLabel(id),
    }));
  }, [recents, t]);

  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMoreRecents) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMoreRecents();
      },
      { rootMargin: `${SCROLL_LOAD_THRESHOLD}px` },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreRecents, loadMoreRecents]);

  if (!isInit) {
    return <SkeletonList rows={3} />;
  }

  return (
    <Flexbox
      className={styles.list}
      data-testid="home-recents-list"
      gap={1}
    >
      {groupedRecents.map((group) => (
        <Flexbox gap={1} key={group.id}>
          <Text className={styles.groupTitle}>{group.label}</Text>
          {group.items.map((item) => (
            <Link
              key={`${item.type}-${item.id}`}
              style={{ color: 'inherit', textDecoration: 'none' }}
              to={resolveHomeRecentRoutePath(item, hideAgentManagement)}
            >
              <RecentListItem {...item} />
            </Link>
          ))}
        </Flexbox>
      ))}
      {hasMoreRecents && <div ref={sentinelRef} aria-hidden className={styles.sentinel} />}
    </Flexbox>
  );
});

export default RecentsList;
