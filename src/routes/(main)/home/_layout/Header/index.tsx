'use client';

import { memo } from 'react';

import SideBarHeaderLayout from '@/features/NavPanel/SideBarHeaderLayout';
import ToggleLeftPanelButton from '@/features/NavPanel/ToggleLeftPanelButton';

import HomeModelIcon from './components/HomeModelIcon';
import InboxButton from './components/InboxButton';
import Nav from './components/Nav';
import SearchButton from './components/SearchButton';

const Header = memo(() => {
  return (
    <>
      <SideBarHeaderLayout
        left={<HomeModelIcon />}
        showBack={false}
        showTogglePanelButton={false}
        right={
          <>
            <SearchButton />
            <ToggleLeftPanelButton />
            <InboxButton />
          </>
        }
      />
      <Nav />
    </>
  );
});

export default Header;
