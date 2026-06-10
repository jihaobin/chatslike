import { ModelIcon } from '@lobehub/icons';
import { Center } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { memo, useCallback, useEffect } from 'react';

import ModelSwitchPanel from '@/features/ModelSwitchPanel';
import { getEffectiveChatModel, useEnabledChatModels } from '@/hooks/useEnabledChatModels';
import { useAgentStore } from '@/store/agent';
import { agentByIdSelectors } from '@/store/agent/selectors';

import { useAgentId } from '../../hooks/useAgentId';
import { useActionBarContext } from '../context';

const styles = createStaticStyles(({ css, cssVar }) => ({
  icon: css`
    transition: scale 400ms cubic-bezier(0.215, 0.61, 0.355, 1);
  `,
  model: css`
    cursor: pointer;
    border-radius: 24px;

    :hover {
      background: ${cssVar.colorFillSecondary};
    }

    :active {
      div {
        scale: 0.8;
      }
    }
  `,
}));

const ModelSwitch = memo(() => {
  const { actionSize, dropdownPlacement } = useActionBarContext();
  const blockSize = actionSize?.blockSize ?? 32;
  const iconSize = actionSize?.size ?? 20;

  const agentId = useAgentId();
  const [model, provider, updateAgentConfigById] = useAgentStore((s) => [
    agentByIdSelectors.getAgentModelById(agentId)(s),
    agentByIdSelectors.getAgentModelProviderById(agentId)(s),
    s.updateAgentConfigById,
  ]);
  const enabledList = useEnabledChatModels();
  const effectiveSelection = getEffectiveChatModel(enabledList, model, provider);
  const effectiveModel = effectiveSelection?.model ?? '';
  const effectiveProvider = effectiveSelection?.provider ?? '';

  useEffect(() => {
    if (!effectiveSelection || (effectiveModel === model && effectiveProvider === provider)) return;

    updateAgentConfigById(agentId, effectiveSelection);
  }, [
    agentId,
    effectiveModel,
    effectiveProvider,
    effectiveSelection,
    model,
    provider,
    updateAgentConfigById,
  ]);

  const handleModelChange = useCallback(
    async (params: { model: string; provider: string }) => {
      await updateAgentConfigById(agentId, params);
    },
    [agentId, updateAgentConfigById],
  );

  return (
    <ModelSwitchPanel
      model={effectiveModel}
      placement={dropdownPlacement}
      provider={effectiveProvider}
      onModelChange={handleModelChange}
    >
      <Center className={styles.model} height={blockSize} width={blockSize}>
        <div className={styles.icon}>
          <ModelIcon model={effectiveModel} size={iconSize} />
        </div>
      </Center>
    </ModelSwitchPanel>
  );
});

ModelSwitch.displayName = 'ModelSwitch';

export default ModelSwitch;
