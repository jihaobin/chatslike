import { Flexbox } from '@lobehub/ui';
import { type FC } from 'react';

import HomePageTracker from '@/components/Analytics/HomePageTracker';
import NavHeader from '@/features/NavHeader';
import WideScreenContainer from '@/features/WideScreenContainer';

import HomeContent from './features';
import HomeModelSelector from './features/HomeModelSelector';

const Home: FC = () => {
  return (
    <>
      <HomePageTracker />
      <NavHeader left={<HomeModelSelector />} />
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
