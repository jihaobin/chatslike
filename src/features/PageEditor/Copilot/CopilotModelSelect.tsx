import { Center, Flexbox } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { ChevronDownIcon } from 'lucide-react';
import { memo, useCallback } from 'react';

import { conversationSelectors, useConversationStore } from '@/features/Conversation';
import ModelSwitchPanel from '@/features/ModelSwitchPanel';
import { useAgentStore } from '@/store/agent';
import { agentByIdSelectors } from '@/store/agent/selectors';
import { aiModelSelectors, useAiInfraStore } from '@/store/aiInfra';

const styles = createStaticStyles(({ css, cssVar }) => ({
  chevron: css`
    color: ${cssVar.colorTextQuaternary};
  `,
  name: css`
    overflow: hidden;

    max-width: 120px;

    font-size: 12px;
    line-height: 1;
    color: ${cssVar.colorTextSecondary};
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  trigger: css`
    cursor: pointer;
    border-radius: 6px;

    :hover {
      background: ${cssVar.colorFillTertiary};
    }
  `,
}));

const CopilotModelSelect = memo(() => {
  const agentId = useConversationStore(conversationSelectors.agentId);

  const [model, provider, updateAgentConfigById] = useAgentStore((s) => [
    agentByIdSelectors.getAgentModelById(agentId)(s),
    agentByIdSelectors.getAgentModelProviderById(agentId)(s),
    s.updateAgentConfigById,
  ]);

  const enabledModel = useAiInfraStore(aiModelSelectors.getEnabledModelById(model, provider));

  const displayName = enabledModel?.displayName || model;

  const handleModelChange = useCallback(
    async (params: { model: string; provider: string }) => {
      await updateAgentConfigById(agentId, params);
    },
    [agentId, updateAgentConfigById],
  );

  return (
    <Flexbox horizontal align={'center'}>
      <ModelSwitchPanel
        model={model}
        openOnHover={false}
        provider={provider}
        onModelChange={handleModelChange}
      >
        <Center horizontal className={styles.trigger} height={28} paddingInline={6}>
          <Flexbox horizontal align={'center'} gap={2}>
            <span className={styles.name}>{displayName}</span>
            <ChevronDownIcon className={styles.chevron} size={12} />
          </Flexbox>
        </Center>
      </ModelSwitchPanel>
    </Flexbox>
  );
});

CopilotModelSelect.displayName = 'CopilotModelSelect';

export default CopilotModelSelect;
