'use client';

import { ActionIcon, Flexbox, Tag } from '@lobehub/ui';
import { ChevronDownIcon, ChevronRightIcon, LayoutGridIcon, SquarePenIcon } from 'lucide-react';
import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import type { NavItemProps } from '@/features/NavPanel/components/NavItem';
import NavItem from '@/features/NavPanel/components/NavItem';
import { useActiveTabKey } from '@/hooks/useActiveTabKey';
import { useNavLayout } from '@/hooks/useNavLayout';
import { useChatStore } from '@/store/chat';
import { useHomeStore } from '@/store/home';
import { useServerConfigStore } from '@/store/serverConfig';
import { featureFlagsSelectors } from '@/store/serverConfig/selectors';
import { isModifierClick } from '@/utils/navigation';

/** Keys rendered as first-level header nav entries. */
const HEADER_LINK_KEYS = new Set(['resource']);
const MORE_CHILD_KEY = 'pages';
const HOME_WORKSPACE_URLS: Partial<Record<string, string>> = {
  pages: '/home/page',
  resource: '/home/resource',
};

const getHomeWorkspaceUrl = (item: { key: string; url?: string }) =>
  HOME_WORKSPACE_URLS[item.key] ?? item.url;

const Nav = memo(() => {
  const tab = useActiveTabKey();
  const navigate = useNavigate();
  const { t } = useTranslation('common');
  const { t: tTopic } = useTranslation('topic');
  const { topNavItems: items } = useNavLayout();
  const hideAgentManagement = useServerConfigStore(featureFlagsSelectors)?.hideAgentManagement;
  const setHomeChatMode = useHomeStore((s) => s.setHomeChatMode);
  const [moreExpanded, setMoreExpanded] = useState(false);
  const handleMoreToggle = useCallback(() => setMoreExpanded((value) => !value), []);

  const handleNewChat = useCallback(() => {
    setHomeChatMode('welcome');
    useChatStore.setState(
      { activeThreadId: undefined, activeTopicId: undefined },
      false,
      'HomeNav/newChat',
    );
    navigate('/home');
  }, [navigate, setHomeChatMode]);

  const newBadge = (
    <Tag color="blue" size="small">
      {t('new')}
    </Tag>
  );
  const pagesItem = items.find((item) => item.key === MORE_CHILD_KEY);
  const pagesUrl = pagesItem ? getHomeWorkspaceUrl(pagesItem) : undefined;

  return (
    <Flexbox gap={1} paddingInline={4}>
      {hideAgentManagement && (
        <NavItem
          icon={SquarePenIcon}
          title={tTopic('management.actions.newChat')}
          onClick={handleNewChat}
        />
      )}
      {items
        .filter((item) => HEADER_LINK_KEYS.has(item.key) && !item.hidden)
        .map((item) => {
          const extra = item.isNew ? newBadge : undefined;
          const targetUrl = getHomeWorkspaceUrl(item);

          const navItem = (
            <NavItem
              active={tab === item.key}
              extra={extra}
              hidden={item.hidden}
              icon={item.icon as NavItemProps['icon']}
              title={item.title}
              onClick={item.onClick}
            />
          );

          if (!targetUrl) return <div key={item.key}>{navItem}</div>;

          return (
            <Link
              key={item.key}
              to={targetUrl}
              onClick={(e) => {
                if (isModifierClick(e)) return;
                e.preventDefault();
                item?.onClick?.();
                navigate(targetUrl);
              }}
            >
              {navItem}
            </Link>
          );
        })}
      {pagesItem && pagesUrl && !pagesItem.hidden && (
        <>
          <NavItem
            icon={LayoutGridIcon}
            title={moreExpanded ? t('collapse') : t('more')}
            extra={
              <ActionIcon
                icon={moreExpanded ? ChevronDownIcon : ChevronRightIcon}
                size={16}
                style={{ flex: 'none' }}
                onClick={handleMoreToggle}
              />
            }
            onClick={handleMoreToggle}
          />
          {moreExpanded && (
            <Link
              to={pagesUrl}
              onClick={(e) => {
                if (isModifierClick(e)) return;
                e.preventDefault();
                pagesItem?.onClick?.();
                navigate(pagesUrl);
              }}
            >
              <NavItem
                active={tab === pagesItem.key}
                hidden={pagesItem.hidden}
                icon={pagesItem.icon as NavItemProps['icon']}
                title={pagesItem.title}
                onClick={pagesItem.onClick}
              />
            </Link>
          )}
        </>
      )}
    </Flexbox>
  );
});

export default Nav;
