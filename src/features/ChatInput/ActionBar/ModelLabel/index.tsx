import { Center, Flexbox } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { ChevronDownIcon } from 'lucide-react';
import { memo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import ModelSwitchPanel from '@/features/ModelSwitchPanel';
import { getEffectiveChatModel, useEnabledChatModels } from '@/hooks/useEnabledChatModels';
import { useAgentStore } from '@/store/agent';
import { agentByIdSelectors } from '@/store/agent/selectors';
import { aiModelSelectors, useAiInfraStore } from '@/store/aiInfra';

import { useAgentId } from '../../hooks/useAgentId';
import { useActionBarContext } from '../context';

const styles = createStaticStyles(({ css, cssVar }) => ({
  chevron: css`
    color: ${cssVar.colorTextQuaternary};
  `,
  name: css`
    overflow: hidden;

    max-width: 160px;

    font-size: 12px;
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

const ModelLabel = memo(() => {
  const { t } = useTranslation('components');
  const { dropdownPlacement } = useActionBarContext();

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

  const enabledModel = useAiInfraStore(
    aiModelSelectors.getEnabledModelById(effectiveModel, effectiveProvider),
  );
  const displayName = enabledModel?.displayName || effectiveModel || t('ModelSwitchPanel.emptyModel');

  useEffect(() => {
    if (!effectiveSelection || (effectiveModel === model && effectiveProvider === provider)) return;

    updateAgentConfigById(agentId, effectiveSelection);
  }, [agentId, effectiveModel, effectiveProvider, effectiveSelection, model, provider, updateAgentConfigById]);

  const handleModelChange = useCallback(
    async (params: { model: string; provider: string }) => {
      await updateAgentConfigById(agentId, params);
    },
    [agentId, updateAgentConfigById],
  );

  return (
    <ModelSwitchPanel
      model={effectiveModel}
      openOnHover={false}
      placement={dropdownPlacement}
      provider={effectiveProvider}
      onModelChange={handleModelChange}
    >
      <Center horizontal className={styles.trigger} height={28} paddingInline={6}>
        <Flexbox horizontal align={'center'} gap={2}>
          <span className={styles.name}>{displayName}</span>
          <ChevronDownIcon className={styles.chevron} size={12} />
        </Flexbox>
      </Center>
    </ModelSwitchPanel>
  );
});

ModelLabel.displayName = 'ModelLabel';

export default ModelLabel;
