'use client';

import { ActionIcon } from '@lobehub/ui';
import { SearchIcon } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { DESKTOP_HEADER_ICON_SMALL_SIZE } from '@/const/layoutTokens';
import { useGlobalStore } from '@/store/global';

const SearchButton = memo(() => {
  const { t } = useTranslation('common');
  const toggleCommandMenu = useGlobalStore((s) => s.toggleCommandMenu);

  return (
    <ActionIcon
      icon={SearchIcon}
      size={DESKTOP_HEADER_ICON_SMALL_SIZE}
      title={t('tab.search')}
      onClick={() => toggleCommandMenu(true)}
    />
  );
});

export default SearchButton;
