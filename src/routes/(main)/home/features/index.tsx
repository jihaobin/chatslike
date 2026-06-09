'use client';

import { Flexbox } from '@lobehub/ui';
import { memo } from 'react';

import DailyBrief from '@/features/DailyBrief';
import { useUserStore } from '@/store/user';
import { authSelectors } from '@/store/user/slices/auth/selectors';

import InputArea from './InputArea';
import WelcomeText from './WelcomeText';

const Home = memo(() => {
  const isLogin = useUserStore(authSelectors.isLogin);

  return (
    <Flexbox gap={40}>
      <Flexbox gap={24}>
        <Flexbox align={'center'} data-testid="home-welcome-hero" gap={8} width={'100%'}>
          <WelcomeText />
        </Flexbox>
        <InputArea />
      </Flexbox>

      {isLogin && (
        <Flexbox gap={40}>
          <DailyBrief />
        </Flexbox>
      )}
    </Flexbox>
  );
});

export default Home;
