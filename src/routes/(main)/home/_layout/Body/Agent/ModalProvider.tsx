'use client';

import type { ReactNode } from 'react';
import { createContext, lazy, memo, Suspense, use, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useEditingPopoverStore } from '@/features/EditingPopover/store';
import { useAgentStore } from '@/store/agent';
import { builtinAgentSelectors } from '@/store/agent/selectors';
import { useGlobalStore } from '@/store/global';
import { useHomeStore } from '@/store/home';

const ChatGroupWizard = lazy(() =>
  import('@/components/ChatGroupWizard').then(({ ChatGroupWizard }) => ({
    default: ChatGroupWizard,
  })),
);
const MemberSelectionModal = lazy(() =>
  import('@/components/MemberSelectionModal').then(({ MemberSelectionModal }) => ({
    default: MemberSelectionModal,
  })),
);
const CreatePlatformAgentModal = lazy(() => import('@/features/CreatePlatformAgent'));
const EditingPopover = lazy(() => import('@/features/EditingPopover'));
const CreateAgentModal = lazy(() =>
  import('@/routes/(main)/home/_layout/hooks/useCreateModal').then(({ CreateAgentModal }) => ({
    default: CreateAgentModal,
  })),
);
const ConfigGroupModal = lazy(() => import('./Modals/ConfigGroupModal'));
const CreateGroupModal = lazy(() => import('./Modals/CreateGroupModal'));

interface OpenCreateModalOptions {
  groupId?: string;
}

interface AgentModalContextValue {
  closeAllModals: () => void;
  closeConfigGroupModal: () => void;
  closeCreateGroupModal: () => void;
  closeCreatePlatformAgentModal: () => void;
  closeGroupWizardModal: () => void;
  closeMemberSelectionModal: () => void;
  openConfigGroupModal: () => void;
  openCreateGroupModal: (sessionId: string) => void;
  openCreateModal: (type: 'agent' | 'group', options?: OpenCreateModalOptions) => void;
  openCreatePlatformAgentModal: (options?: OpenCreateModalOptions) => void;
  openGroupWizardModal: (callbacks: GroupWizardCallbacks) => void;
  openMemberSelectionModal: (callbacks: MemberSelectionCallbacks) => void;
  setGroupWizardLoading: (loading: boolean) => void;
}

interface GroupWizardCallbacks {
  onCancel?: () => void;
  onCreateCustom?: (selectedAgents: string[]) => Promise<void>;
  onCreateFromTemplate?: (templateId: string, selectedMemberTitles?: string[]) => Promise<void>;
}

interface MemberSelectionCallbacks {
  onCancel?: () => void;
  onConfirm?: (selectedAgents: string[]) => Promise<void>;
}

const AgentModalContext = createContext<AgentModalContextValue | null>(null);

export const useAgentModal = () => {
  const context = use(AgentModalContext);
  if (!context) {
    throw new Error('useAgentModal must be used within AgentModalProvider');
  }
  return context;
};

export const useOptionalAgentModal = () => {
  return use(AgentModalContext);
};

interface CreateModalRendererProps {
  groupId?: string;
  onClose: () => void;
  open: boolean;
  type: 'agent' | 'group';
}

const CreateModalRenderer = memo<CreateModalRendererProps>(({ open, type, groupId, onClose }) => {
  if (!open) return null;

  return (
    <Suspense fallback={null}>
      <CreateModalContent groupId={groupId} type={type} onClose={onClose} />
    </Suspense>
  );
});

const CreateModalContent = memo<Omit<CreateModalRendererProps, 'open'>>(
  ({ type, groupId, onClose }) => {
    const navigate = useNavigate();
    const inboxAgentId = useAgentStore(builtinAgentSelectors.inboxAgentId);
    const storeCreateAgent = useAgentStore((s) => s.createAgent);
    const refreshAgentList = useHomeStore((s) => s.refreshAgentList);
    const sendAsAgent = useHomeStore((s) => s.sendAsAgent);
    const sendAsGroup = useHomeStore((s) => s.sendAsGroup);

    const handleSubmit = useCallback(
      async (prompt: string) => {
        if (type === 'agent') {
          await sendAsAgent({ groupId, message: prompt });
        } else {
          await sendAsGroup({ groupId, message: prompt });
        }
      },
      [type, sendAsAgent, sendAsGroup, groupId],
    );

    const handleCreateBlank = useCallback(async () => {
      if (type === 'agent') {
        const result = await storeCreateAgent({ groupId });
        useGlobalStore.getState().toggleAgentBuilderPanel(true);
        navigate(`/agent/${result.agentId}/profile`);
        await refreshAgentList();
      } else {
        await sendAsGroup({ groupId, message: '' });
      }
    }, [type, storeCreateAgent, navigate, refreshAgentList, sendAsGroup, groupId]);

    return (
      <CreateAgentModal
        open
        agentId={inboxAgentId}
        type={type}
        onClose={onClose}
        onCreateBlank={handleCreateBlank}
        onSubmit={handleSubmit}
      />
    );
  },
);

const EditingPopoverRenderer = memo(() => {
  const hasTarget = useEditingPopoverStore((s) => s.target !== null);

  if (!hasTarget) return null;

  return (
    <Suspense fallback={null}>
      <EditingPopover />
    </Suspense>
  );
});

interface AgentModalProviderProps {
  children: ReactNode;
}

export const AgentModalProvider = memo<AgentModalProviderProps>(({ children }) => {
  // CreateGroupModal state
  const [createGroupModalOpen, setCreateGroupModalOpen] = useState(false);
  const [createGroupSessionId, setCreateGroupSessionId] = useState<string>('');

  // ConfigGroupModal state
  const [configGroupModalOpen, setConfigGroupModalOpen] = useState(false);

  // GroupWizard state
  const [groupWizardOpen, setGroupWizardOpen] = useState(false);
  const [groupWizardCallbacks, setGroupWizardCallbacks] = useState<GroupWizardCallbacks>({});
  const [groupWizardLoading, setGroupWizardLoading] = useState(false);

  // MemberSelection state
  const [memberSelectionOpen, setMemberSelectionOpen] = useState(false);
  const [memberSelectionCallbacks, setMemberSelectionCallbacks] =
    useState<MemberSelectionCallbacks>({});

  // CreateAgentModal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createModalType, setCreateModalType] = useState<'agent' | 'group'>('agent');
  const [createModalGroupId, setCreateModalGroupId] = useState<string | undefined>(undefined);

  // CreatePlatformAgentModal state
  const [createPlatformAgentOpen, setCreatePlatformAgentOpen] = useState(false);
  const [createPlatformAgentGroupId, setCreatePlatformAgentGroupId] = useState<string | undefined>(
    undefined,
  );

  const contextValue = useMemo<AgentModalContextValue>(
    () => ({
      closeAllModals: () => {
        setCreateGroupModalOpen(false);
        setConfigGroupModalOpen(false);
        setGroupWizardOpen(false);
        setMemberSelectionOpen(false);
        setCreateModalOpen(false);
        setCreatePlatformAgentOpen(false);
      },
      closeConfigGroupModal: () => setConfigGroupModalOpen(false),
      closeCreateGroupModal: () => setCreateGroupModalOpen(false),
      closeCreatePlatformAgentModal: () => setCreatePlatformAgentOpen(false),
      closeGroupWizardModal: () => setGroupWizardOpen(false),
      closeMemberSelectionModal: () => setMemberSelectionOpen(false),
      openConfigGroupModal: () => setConfigGroupModalOpen(true),
      openCreateGroupModal: (sessionId: string) => {
        setCreateGroupSessionId(sessionId);
        setCreateGroupModalOpen(true);
      },
      openCreateModal: (type: 'agent' | 'group', options?: OpenCreateModalOptions) => {
        setCreateModalType(type);
        setCreateModalGroupId(options?.groupId);
        setCreateModalOpen(true);
      },
      openCreatePlatformAgentModal: (options?: OpenCreateModalOptions) => {
        setCreatePlatformAgentGroupId(options?.groupId);
        setCreatePlatformAgentOpen(true);
      },
      openGroupWizardModal: (callbacks: GroupWizardCallbacks) => {
        setGroupWizardCallbacks(callbacks);
        setGroupWizardOpen(true);
      },
      openMemberSelectionModal: (callbacks: MemberSelectionCallbacks) => {
        setMemberSelectionCallbacks(callbacks);
        setMemberSelectionOpen(true);
      },
      setGroupWizardLoading,
    }),
    [],
  );

  return (
    <AgentModalContext value={contextValue}>
      <CreateModalRenderer
        groupId={createModalGroupId}
        open={createModalOpen}
        type={createModalType}
        onClose={() => setCreateModalOpen(false)}
      />
      {createPlatformAgentOpen && (
        <Suspense fallback={null}>
          <CreatePlatformAgentModal
            groupId={createPlatformAgentGroupId}
            open={createPlatformAgentOpen}
            onClose={() => setCreatePlatformAgentOpen(false)}
          />
        </Suspense>
      )}
      {children}

      {createGroupModalOpen && (
        <Suspense fallback={null}>
          <CreateGroupModal
            id={createGroupSessionId}
            open={createGroupModalOpen}
            onCancel={() => setCreateGroupModalOpen(false)}
          />
        </Suspense>
      )}

      {configGroupModalOpen && (
        <Suspense fallback={null}>
          <ConfigGroupModal
            open={configGroupModalOpen}
            onCancel={() => setConfigGroupModalOpen(false)}
          />
        </Suspense>
      )}

      {groupWizardOpen && (
        <Suspense fallback={null}>
          <ChatGroupWizard
            isCreatingFromTemplate={groupWizardLoading}
            open={groupWizardOpen}
            onCancel={() => {
              groupWizardCallbacks.onCancel?.();
              setGroupWizardOpen(false);
            }}
            onCreateCustom={async (selectedAgents: string[]) => {
              await groupWizardCallbacks.onCreateCustom?.(selectedAgents);
            }}
            onCreateFromTemplate={async (templateId: string, selectedMemberTitles?: string[]) => {
              await groupWizardCallbacks.onCreateFromTemplate?.(templateId, selectedMemberTitles);
            }}
          />
        </Suspense>
      )}

      {memberSelectionOpen && (
        <Suspense fallback={null}>
          <MemberSelectionModal
            mode="create"
            open={memberSelectionOpen}
            onCancel={() => {
              memberSelectionCallbacks.onCancel?.();
              setMemberSelectionOpen(false);
            }}
            onConfirm={async (selectedAgents: string[]) => {
              await memberSelectionCallbacks.onConfirm?.(selectedAgents);
            }}
          />
        </Suspense>
      )}

      <EditingPopoverRenderer />
    </AgentModalContext>
  );
});
