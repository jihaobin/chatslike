'use client';

import ModelIcon from '@lobehub/icons/es/features/ModelIcon';
import { Center } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { memo } from 'react';

import { useAgentStore } from '@/store/agent';
import { agentSelectors } from '@/store/agent/selectors';

const styles = createStaticStyles(({ css }) => ({
  icon: css`
    flex: none;

    width: 32px;
    height: 32px;
    border-radius: 8px;
  `,
}));

const HomeModelIcon = memo(() => {
  const model = useAgentStore(agentSelectors.currentAgentModel);

  return (
    <Center aria-label={model} className={styles.icon}>
      <ModelIcon model={model} size={24} />
    </Center>
  );
});

HomeModelIcon.displayName = 'HomeModelIcon';

export default HomeModelIcon;
