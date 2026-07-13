import { Flexbox } from '@lobehub/ui';
import { type FC } from 'react';
import { useSearchParams } from 'react-router-dom';

import HomePageTracker from '@/components/Analytics/HomePageTracker';
import InboxChatWorkspace from '@/features/Home/InboxChatWorkspace';
import NavHeader from '@/features/NavHeader';
import WideScreenContainer from '@/features/WideScreenContainer';
import { useHomeStore } from '@/store/home';
import { useServerConfigStore } from '@/store/serverConfig';
import { featureFlagsSelectors } from '@/store/serverConfig/selectors';

import SettingsButton from './_layout/Header/components/SettingsButton';
import User from './_layout/Header/components/User';
import HomeContent from './features';
import HomeModelSelector from './features/HomeModelSelector';

const Home: FC = () => {
  const [searchParams] = useSearchParams();
  const hideAgentManagement = useServerConfigStore(featureFlagsSelectors)?.hideAgentManagement;
  const homeChatMode = useHomeStore((s) => s.homeChatMode);
  const showInboxChat =
    hideAgentManagement && (homeChatMode === 'chat' || searchParams.has('topic'));

  if (showInboxChat) {
    return (
      <>
        <HomePageTracker />
        <InboxChatWorkspace />
      </>
    );
  }

  return (
    <>
      <HomePageTracker />
      <NavHeader
        left={<HomeModelSelector />}
        right={
          <>
            <SettingsButton />
            <User />
          </>
        }
      />
      <Flexbox
        height={'100%'}
        justify={'center'}
        style={{ overflowY: 'auto', paddingBlock: '44px 16vh' }}
        width={'100%'}
      >
        <WideScreenContainer>
          <HomeContent />
        </WideScreenContainer>
      </Flexbox>
    </>
  );
};

export default Home;
