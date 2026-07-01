'use client';

import { App } from 'antd';
import { useCallback } from 'react';

import { useStableNavigate } from '@/hooks/useStableNavigate';
import { useResolvedHomeAgentId } from '@/routes/(main)/home/features/AgentSelect/useResolvedHomeAgentId';
import { agentService } from '@/services/agent';
import { useAgentStore } from '@/store/agent';
import { agentByIdSelectors } from '@/store/agent/selectors';

/**
 * Navigation actions for the Explore portal — the "hub" that routes users into
 * the real feature pages.
 *
 * - Feature buttons jump to existing routes (`/home`, `/home/image`, `/home/video`, `/community`).
 * - A model card preselects that model on the home agent, then enters the chat
 *   workspace. This mirrors `StarterList`'s `updateAgentConfigById` pattern:
 *   chat has no `?model=` param, so we mutate the agent config before navigating.
 *   Image/Video do support `?model=`, so those go straight through the query.
 */
export const useExploreNavigate = () => {
  const navigate = useStableNavigate();
  const { message } = App.useApp();
  const { agentId: activeAgentId } = useResolvedHomeAgentId();
  const updateAgentConfigById = useAgentStore((s) => s.updateAgentConfigById);

  const goChat = useCallback(() => navigate('/home'), [navigate]);
  const goImage = useCallback(
    (model?: string) => navigate(model ? `/home/image?model=${model}` : '/home/image'),
    [navigate],
  );
  const goVideo = useCallback(
    (model?: string) => navigate(model ? `/home/video?model=${model}` : '/home/video'),
    [navigate],
  );
  const goCommunity = useCallback(() => navigate('/community'), [navigate]);

  /**
   * Open the chat workspace with the given model preselected on the home agent.
   * Hydrates the agent config first so the optimistic update doesn't drop
   * pre-existing fields the portal never loaded (same guard as StarterList).
   */
  const startChatWithModel = useCallback(
    async (model: string, provider: string) => {
      if (!activeAgentId) {
        navigate('/home');
        return;
      }

      try {
        let agentState = useAgentStore.getState();
        if (!agentState.agentMap[activeAgentId]) {
          const config = await agentService.getAgentConfigById(activeAgentId);
          if (config) agentState.internal_dispatchAgentMap(activeAgentId, config);
          agentState = useAgentStore.getState();
        }

        const currentModel = agentByIdSelectors.getAgentModelById(activeAgentId)(agentState);
        const currentProvider =
          agentByIdSelectors.getAgentModelProviderById(activeAgentId)(agentState);

        if (currentModel !== model || currentProvider !== provider) {
          await updateAgentConfigById(activeAgentId, { model, provider });
        }
      } catch {
        message.error('Failed to switch model');
      } finally {
        navigate('/home');
      }
    },
    [activeAgentId, updateAgentConfigById, navigate, message],
  );

  return { goChat, goCommunity, goImage, goVideo, startChatWithModel };
};
