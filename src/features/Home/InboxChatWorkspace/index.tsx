'use client';

import { Flexbox } from '@lobehub/ui';
import { memo } from 'react';

import HeaderSlot from '@/routes/(main)/agent/(chat)/_layout/HeaderSlot';
import Conversation from '@/routes/(main)/agent/features/Conversation';
import ChatHeader from '@/routes/(main)/agent/features/Conversation/Header';
import AgentWorkingSidebar from '@/routes/(main)/agent/features/Conversation/WorkingSidebar';
import Portal from '@/routes/(main)/agent/features/Portal';
import TelemetryNotification from '@/routes/(main)/agent/features/TelemetryNotification';
import { useGlobalStore } from '@/store/global';
import { systemStatusSelectors } from '@/store/global/selectors';

import HomeChatHydration from './HomeChatHydration';

const InboxChatWorkspace = memo(() => {
  const showHeader = useGlobalStore(systemStatusSelectors.showChatHeader);

  return (
    <HeaderSlot.Provider>
      <HomeChatHydration />
      <Flexbox
        horizontal
        flex={1}
        height={'100%'}
        style={{ minHeight: 0, overflow: 'hidden', position: 'relative' }}
        width={'100%'}
      >
        <Flexbox flex={1} style={{ minHeight: 0, minWidth: 0 }}>
          {showHeader && <ChatHeader />}
          <Flexbox flex={1} style={{ minHeight: 0, position: 'relative' }}>
            <Conversation />
          </Flexbox>
        </Flexbox>
        <Portal />
        <AgentWorkingSidebar />
      </Flexbox>
      <TelemetryNotification mobile={false} />
    </HeaderSlot.Provider>
  );
});

InboxChatWorkspace.displayName = 'InboxChatWorkspace';

export default InboxChatWorkspace;
