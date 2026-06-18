'use client';

import { Flexbox } from '@lobehub/ui';
import { memo } from 'react';

import InputArea from './InputArea';
import WelcomeText from './WelcomeText';

const Home = memo(() => {
  return (
    <Flexbox gap={40}>
      <Flexbox gap={24}>
        <Flexbox align={'center'} data-testid="home-welcome-hero" gap={8} width={'100%'}>
          <WelcomeText />
        </Flexbox>
        <InputArea />
      </Flexbox>
    </Flexbox>
  );
});

export default Home;
