import { createStaticStyles, cx } from 'antd-style';
import { Plus, SendHorizontal } from 'lucide-react';
import type { CSSProperties, KeyboardEvent } from 'react';
import {
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import DragUploadZone, { useUploadFiles } from '@/components/DragUploadZone';
import { useEnterToSend } from '@/hooks/useEnterToSend';
import { useHomeDailyBrief } from '@/hooks/useHomeDailyBrief';
import { useInitAgentConfig } from '@/hooks/useInitAgentConfig';
import { useAgentStore } from '@/store/agent';
import { agentByIdSelectors } from '@/store/agent/selectors';
import { builtinAgentSelectors } from '@/store/agent/selectors/builtinAgentSelectors';
import { useChatStore } from '@/store/chat';
import { useGlobalStore } from '@/store/global';
import { systemStatusSelectors } from '@/store/global/selectors';
import { serverConfigSelectors, useServerConfigStore } from '@/store/serverConfig';

import BotIntegrationBanner, { BOT_INTEGRATION_BANNER_ID } from './BotIntegrationBanner';
import { stripMarkdownLinks } from './hintFormat';
import MessengerBanner, { MESSENGER_BANNER_ID } from './MessengerBanner';
import SkillInstallBanner, { SKILL_INSTALL_BANNER_ID } from './SkillInstallBanner';
import StarterList from './StarterList';
import type { HomeSendHandler } from './useSend';
import { useSend } from './useSend';

type HomeChatInputActionKey = 'agentMode' | 'plus';

const leftActions: HomeChatInputActionKey[] = ['agentMode', 'plus'];
const rightActions: HomeChatInputActionKey[] = [];

type BannerKind = 'skill' | 'botIntegration' | 'messenger';

const styles = createStaticStyles(({ css, cssVar }) => ({
  footer: css`
    display: flex;
    align-items: center;
    justify-content: space-between;

    min-height: 40px;
    padding-block: 0 8px;
    padding-inline: 8px;
  `,
  iconButton: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;

    width: 32px;
    height: 32px;
    padding: 0;
    border: none;
    border-radius: 50%;

    color: ${cssVar.colorTextSecondary};
    background: transparent;
    cursor: pointer;

    transition:
      color 0.16s ease,
      background 0.16s ease,
      opacity 0.16s ease;

    &:hover {
      color: ${cssVar.colorText};
      background: ${cssVar.colorFillSecondary};
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.45;
    }
  `,
  inputSlot: css`
    position: relative;
  `,
  root: css`
    display: flex;
    flex-direction: column;
    gap: 16px;

    margin-block-end: 16px;
  `,
  sendButton: css`
    color: ${cssVar.colorTextLightSolid};
    background: ${cssVar.colorPrimary};

    &:hover {
      color: ${cssVar.colorTextLightSolid};
      background: ${cssVar.colorPrimaryHover};
    }
  `,
  shell: css`
    position: relative;
    z-index: 1;

    display: flex;
    flex-direction: column;

    min-height: 88px;
    overflow: hidden;

    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 20px;

    background: ${cssVar.colorBgContainer};
    box-shadow: 0 12px 32px rgb(0 0 0 / 4%);

    transition:
      border-color 0.16s ease,
      box-shadow 0.16s ease;

    &:focus-within {
      border-color: ${cssVar.colorPrimary};
      box-shadow: 0 12px 32px rgb(0 0 0 / 6%);
    }
  `,
  shellActivating: css`
    opacity: 0.72;
  `,
  textarea: css`
    flex: 1;

    width: 100%;
    min-height: 48px;
    padding-block: 14px 6px;
    padding-inline: 16px;
    border: none;
    outline: none;

    color: ${cssVar.colorText};
    background: transparent;

    font: inherit;
    line-height: 1.5;

    resize: none;

    &::placeholder {
      color: ${cssVar.colorTextQuaternary};
    }
  `,
}));

interface RichChatInputProps {
  agentId?: string;
  dailyHint?: string;
  inputContainerProps: {
    minHeight: number;
    resize: boolean;
    style: CSSProperties;
  };
  isAgentConfigLoading: boolean;
  loading: boolean;
  onSend: HomeSendHandler;
}

const RichChatInput = lazy(async () => {
  const { ChatInputProvider, DesktopChatInput } = await import('@/features/ChatInput');

  const RichChatInputComponent = ({
    agentId,
    dailyHint,
    inputContainerProps,
    isAgentConfigLoading,
    loading,
    onSend,
  }: RichChatInputProps) => (
    <ChatInputProvider
      agentId={agentId}
      allowExpand={false}
      chatInputEditorRef={(instance) => {
        if (!instance) return;
        useChatStore.setState({ mainInputEditor: instance });
      }}
      leftActions={leftActions}
      rightActions={rightActions}
      sendButtonProps={{
        disabled: loading || isAgentConfigLoading,
        generating: loading,
        onStop: () => {},
        shape: 'round',
      }}
      slashPlacement="bottom"
      onMarkdownContentChange={(content) => {
        useChatStore.setState({ inputMessage: content });
      }}
      onSend={onSend}
    >
      <DesktopChatInput
        dropdownPlacement="bottomLeft"
        inputContainerProps={inputContainerProps}
        placeholder={dailyHint}
        showRuntimeConfig={false}
      />
    </ChatInputProvider>
  );

  RichChatInputComponent.displayName = 'HomeRichChatInput';

  return { default: RichChatInputComponent };
});

interface LightweightChatInputProps {
  disabled: boolean;
  isActivating?: boolean;
  onActivate: () => void;
  onDraftChange: (value: string) => void;
  onSend: HomeSendHandler;
  placeholder?: string;
  value: string;
}

const LightweightChatInput = memo<LightweightChatInputProps>(
  ({ disabled, isActivating, onActivate, onDraftChange, onSend, placeholder, value }) => {
    const shouldSendOnEnter = useEnterToSend();
    const isComposingRef = useRef(false);

    const handleSend = useCallback(async () => {
      if (disabled) return;

      await onSend({
        getEditorData: () => undefined,
        getMarkdownContent: () => value.trim(),
      });
      onDraftChange('');
    }, [disabled, onDraftChange, onSend, value]);

    const handleKeyDown = useCallback(
      (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key !== 'Enter' || isComposingRef.current) return;
        if (!shouldSendOnEnter(event)) return;

        event.preventDefault();
        void handleSend();
      },
      [handleSend, shouldSendOnEnter],
    );

    return (
      <div className={cx(styles.shell, isActivating && styles.shellActivating)}>
        <textarea
          aria-label="chat input"
          className={styles.textarea}
          placeholder={placeholder}
          rows={2}
          value={value}
          onChange={(event) => {
            onDraftChange(event.target.value);
          }}
          onCompositionEnd={() => {
            isComposingRef.current = false;
          }}
          onCompositionStart={() => {
            isComposingRef.current = true;
          }}
          onFocus={onActivate}
          onKeyDown={handleKeyDown}
          onPaste={onActivate}
        />
        <div className={styles.footer}>
          <button
            aria-label="open input tools"
            className={styles.iconButton}
            type="button"
            onClick={onActivate}
          >
            <Plus size={18} />
          </button>
          <button
            aria-label="send message"
            className={cx(styles.iconButton, styles.sendButton)}
            disabled={disabled}
            type="button"
            onClick={() => {
              void handleSend();
            }}
          >
            <SendHorizontal size={16} />
          </button>
        </div>
      </div>
    );
  },
);

LightweightChatInput.displayName = 'HomeLightweightChatInput';

const InputArea = () => {
  const { loading, send, agentId } = useSend();
  // Subscribe to the SWR key so `internal_refreshAgentConfig`'s `mutate(...)`
  // has a listener after toggleFile / toggleKnowledgeBase - otherwise the
  // Library submenu doesn't reflect server-side toggles. Pass `agentId`
  // explicitly so AgentSelect switches refetch too.
  useInitAgentConfig(agentId);
  // Use the "config absent from agentMap" loading shape (same as Memory /
  // Search / History) instead of SWR's `isLoading`, which would flash on
  // every mount-time revalidation even when inbox data is already cached.
  const isAgentConfigLoading = useAgentStore((s) =>
    agentByIdSelectors.isAgentConfigLoadingById(agentId ?? '')(s),
  );
  const inboxAgentId = useAgentStore(builtinAgentSelectors.inboxAgentId);
  const isLobehubSkillEnabled = useServerConfigStore(serverConfigSelectors.enableLobehubSkill);
  const isKlavisEnabled = useServerConfigStore(serverConfigSelectors.enableKlavis);
  const serverConfigInit = useServerConfigStore((s) => s.serverConfigInit);
  const isSkillBannerDismissed = useGlobalStore(
    systemStatusSelectors.isBannerDismissed(SKILL_INSTALL_BANNER_ID),
  );
  const isBotIntegrationBannerDismissed = useGlobalStore(
    systemStatusSelectors.isBannerDismissed(BOT_INTEGRATION_BANNER_ID),
  );
  const isMessengerBannerDismissed = useGlobalStore(
    systemStatusSelectors.isBannerDismissed(MESSENGER_BANNER_ID),
  );
  const chatInputRef = useRef<HTMLDivElement>(null);

  // Wait for both stores to finish hydrating before drawing - server config
  // (skill flags) and the agent store (inboxAgentId) hydrate at different
  // times, and picking too early biases the draw toward whichever arrived
  // first. After picking, dismissing the active banner only hides it for
  // this mount - re-mounting re-rolls from the still-undismissed pool.
  const [activeBanner, setActiveBanner] = useState<BannerKind | null>(null);
  const hasPickedRef = useRef(false);
  const [isRichInputRequested, setRichInputRequested] = useState(false);
  const [plainDraft, setPlainDraft] = useState('');

  useEffect(() => {
    if (hasPickedRef.current) return;
    if (!serverConfigInit || !inboxAgentId) return;

    const candidates: BannerKind[] = [];
    if ((isLobehubSkillEnabled || isKlavisEnabled) && !isSkillBannerDismissed) {
      candidates.push('skill');
    }
    if (!isBotIntegrationBannerDismissed) candidates.push('botIntegration');
    if (!isMessengerBannerDismissed) candidates.push('messenger');
    if (candidates.length === 0) return;

    hasPickedRef.current = true;
    setActiveBanner(candidates[Math.floor(Math.random() * candidates.length)]);
  }, [
    inboxAgentId,
    isBotIntegrationBannerDismissed,
    isKlavisEnabled,
    isLobehubSkillEnabled,
    isMessengerBannerDismissed,
    isSkillBannerDismissed,
    serverConfigInit,
  ]);

  const isActiveBannerDismissed =
    (activeBanner === 'skill' && isSkillBannerDismissed) ||
    (activeBanner === 'botIntegration' && isBotIntegrationBannerDismissed) ||
    (activeBanner === 'messenger' && isMessengerBannerDismissed);
  const visibleBanner = isActiveBannerDismissed ? null : activeBanner;

  // Get agent's model info for vision support check. Falls back to an empty
  // id while the agent id resolves; the selectors return DEFAULT_MODEL /
  // DEFAULT_PROVIDER for unknown ids.
  const resolvedAgentId = agentId ?? '';
  const model = useAgentStore((s) => agentByIdSelectors.getAgentModelById(resolvedAgentId)(s));
  const provider = useAgentStore((s) =>
    agentByIdSelectors.getAgentModelProviderById(resolvedAgentId)(s),
  );
  const { handleUploadFiles } = useUploadFiles({ model, provider });

  const inputContainerProps = useMemo(
    () => ({
      minHeight: 88,
      resize: false,
      style: {
        borderRadius: 20,
        boxShadow: '0 12px 32px rgba(0,0,0,.04)',
      },
    }),
    [],
  );

  // Daily-generated input hint paired with the home WelcomeText. The hint
  // tracks whichever pair the WelcomeText typewriter is currently showing,
  // via the shared rotating index inside `useHomeDailyBrief`.
  const { currentPair } = useHomeDailyBrief();
  const dailyHint = currentPair?.hint ? stripMarkdownLinks(currentPair.hint) : undefined;

  const requestRichInput = useCallback(() => {
    setRichInputRequested(true);
  }, []);

  const updatePlainDraft = useCallback((value: string) => {
    setPlainDraft(value);
    useChatStore.setState({ inputMessage: value });
  }, []);

  const shellNode = useMemo(
    () => (
      <LightweightChatInput
        disabled={loading || isAgentConfigLoading}
        onActivate={requestRichInput}
        onDraftChange={updatePlainDraft}
        onSend={send}
        placeholder={dailyHint}
        value={plainDraft}
      />
    ),
    [
      dailyHint,
      isAgentConfigLoading,
      loading,
      plainDraft,
      requestRichInput,
      send,
      updatePlainDraft,
    ],
  );

  const shouldRenderRichInput = isRichInputRequested && !plainDraft;

  return (
    <div className={styles.root}>
      <div
        className={styles.inputSlot}
        ref={chatInputRef}
        style={{ paddingBottom: visibleBanner ? 32 : 0 }}
      >
        {visibleBanner === 'skill' && <SkillInstallBanner />}
        {visibleBanner === 'botIntegration' && <BotIntegrationBanner />}
        {visibleBanner === 'messenger' && <MessengerBanner />}
        <DragUploadZone
          style={{ position: 'relative', zIndex: 1 }}
          onUploadFiles={handleUploadFiles}
        >
          {shouldRenderRichInput ? (
            <Suspense
              fallback={
                <LightweightChatInput
                  disabled={loading || isAgentConfigLoading}
                  isActivating
                  onActivate={requestRichInput}
                  onDraftChange={updatePlainDraft}
                  onSend={send}
                  placeholder={dailyHint}
                  value={plainDraft}
                />
              }
            >
              <RichChatInput
                agentId={agentId}
                dailyHint={dailyHint}
                inputContainerProps={inputContainerProps}
                isAgentConfigLoading={isAgentConfigLoading}
                loading={loading}
                onSend={send}
              />
            </Suspense>
          ) : (
            shellNode
          )}
        </DragUploadZone>
      </div>

      <StarterList />
    </div>
  );
};

export default InputArea;
