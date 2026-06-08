import { Button, Flexbox } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { ChevronDownIcon } from 'lucide-react';
import { memo, useCallback } from 'react';

import ModelSwitchPanel from '@/features/ModelSwitchPanel';
import { useInitAgentConfig } from '@/hooks/useInitAgentConfig';
import { useAgentStore } from '@/store/agent';
import { agentByIdSelectors } from '@/store/agent/selectors';
import { aiModelSelectors, useAiInfraStore } from '@/store/aiInfra';

import { useResolvedHomeAgentId } from './AgentSelect/useResolvedHomeAgentId';

const styles = createStaticStyles(({ css, cssVar }) => ({
  button: css`
    max-width: min(280px, 42vw);
    height: 36px;
    padding-inline: 12px 10px;
    border-radius: 12px;

    color: ${cssVar.colorText};

    &:hover {
      background: ${cssVar.colorFillSecondary};
    }
  `,
  chevron: css`
    flex: none;
    color: ${cssVar.colorTextTertiary};
  `,
  label: css`
    overflow: hidden;

    min-width: 0;
    max-width: 220px;

    font-size: 18px;
    font-weight: 600;
    line-height: 1;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
}));

const HomeModelSelector = memo(() => {
  const { agentId } = useResolvedHomeAgentId();

  useInitAgentConfig(agentId);

  const resolvedAgentId = agentId ?? '';
  const [model, provider, updateAgentConfigById] = useAgentStore((s) => [
    agentByIdSelectors.getAgentModelById(resolvedAgentId)(s),
    agentByIdSelectors.getAgentModelProviderById(resolvedAgentId)(s),
    s.updateAgentConfigById,
  ]);

  const enabledModel = useAiInfraStore(aiModelSelectors.getEnabledModelById(model, provider));
  const displayName = enabledModel?.displayName || model;

  const handleModelChange = useCallback(
    async (params: { model: string; provider: string }) => {
      if (!agentId) return;
      await updateAgentConfigById(agentId, params);
    },
    [agentId, updateAgentConfigById],
  );

  return (
    <ModelSwitchPanel
      model={model}
      openOnHover={false}
      placement={'bottomLeft'}
      provider={provider}
      onModelChange={handleModelChange}
    >
      <Button
        className={styles.button}
        data-testid="home-model-selector"
        disabled={!agentId}
        size={'large'}
        type={'text'}
      >
        <Flexbox horizontal align={'center'} gap={4}>
          <span className={styles.label}>{displayName}</span>
          <ChevronDownIcon className={styles.chevron} size={16} />
        </Flexbox>
      </Button>
    </ModelSwitchPanel>
  );
});

HomeModelSelector.displayName = 'HomeModelSelector';

export default HomeModelSelector;
