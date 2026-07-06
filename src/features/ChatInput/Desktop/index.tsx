'use client';

import { type ChatInputProps } from '@lobehub/editor/react';
import { ChatInput, ChatInputActionBar } from '@lobehub/editor/react';
import { Center, Flexbox, Skeleton, Text } from '@lobehub/ui';
import { createStaticStyles, cx } from 'antd-style';
import { type ReactNode, use } from 'react';
import { memo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { useChatInputStore } from '@/features/ChatInput/store';
import {
  type ConversationChatInputVariant,
  getConversationChatInputVariantConfig,
  resolveConversationChatInputDefaultHeight,
} from '@/features/Conversation/ChatInput/layout';
import { LayoutContainerContext } from '@/routes/(main)/_layout/DesktopLayoutContainer/LayoutContainerContext';
import { useChatStore } from '@/store/chat';
import { chatSelectors } from '@/store/chat/selectors';
import { fileChatSelectors, useFileStore } from '@/store/file';
import { useGlobalStore } from '@/store/global';
import { systemStatusSelectors } from '@/store/global/selectors';

import { type ActionToolbarProps } from '../ActionBar';
import ActionBar from '../ActionBar';
import InputEditor from '../InputEditor';
import { useSkillDrop } from '../InputEditor/ActionTag/useSkillDrop';
import { type PlaceholderVariant } from '../InputEditor/Placeholder';
import RuntimeConfig from '../RuntimeConfig';
import SendArea from '../SendArea';
import TypoBar from '../TypoBar';
import ContextContainer from './ContextContainer';

const styles = createStaticStyles(({ css, cssVar }) => ({
  container: css`
    .show-on-hover {
      opacity: 0;
    }

    &:hover {
      .show-on-hover {
        opacity: 1;
      }
    }
  `,
  footnote: css`
    font-size: 10px;
  `,
  fullscreen: css`
    position: absolute;
    z-index: 100;
    inset: 0;

    width: 100%;
    height: 100%;
    margin-block-start: 0;

    background: ${cssVar.colorBgContainer};
  `,
  inputFullscreen: css`
    border: none;
    border-radius: 0 !important;
  `,
  input_chatgpt: css`
    overflow: hidden;

    border: 1px solid ${cssVar.colorBorderSecondary} !important;
    border-radius: 26px !important;

    background: ${cssVar.colorBgContainer};
    box-shadow: 0 12px 36px rgb(0 0 0 / 8%);
  `,
  inputBody_chatgpt: css`
    padding-block: 12px 0 !important;
    padding-inline: 14px !important;
  `,
  inputFooter_chatgpt: css`
    overflow: hidden;
    padding-block: 0 4px;
  `,
  inputHeader_chatgpt: css`
    overflow: hidden;
  `,
  runtimeConfig_chatgpt: css`
    margin-block-start: -2px;
    padding-inline: 10px;

    font-size: 12px;

    opacity: 0.72;

    transition: opacity 0.16s ease;

    &:hover {
      opacity: 1;
    }

    & > div {
      min-height: 24px;
      padding-inline: 0;
    }
  `,
}));

interface DesktopChatInputProps extends ActionToolbarProps {
  actionBarStyle?: React.CSSProperties;
  extentHeaderContent?: ReactNode;
  inputContainerProps?: ChatInputProps;
  /**
   * Swap the action bar and send area for skeleton placeholders while
   * the underlying agent / group / session config is still hydrating.
   * The editor itself stays usable. Wins over `leftContent` / `rightContent`.
   */
  isConfigLoading?: boolean;
  leftContent?: ReactNode;
  placeholder?: ReactNode;
  placeholderVariant?: PlaceholderVariant;
  rightContent?: ReactNode;
  /**
   * Custom node to render in place of the default RuntimeConfig bar.
   * When provided, used instead of `<RuntimeConfig />` (ignores `showRuntimeConfig`).
   */
  runtimeConfigSlot?: ReactNode;
  sendAreaPrefix?: ReactNode;
  showFootnote?: boolean;
  showRuntimeConfig?: boolean;
  variant?: ConversationChatInputVariant;
}

const DesktopChatInput = memo<DesktopChatInputProps>(
  ({
    showFootnote,
    showRuntimeConfig = true,
    runtimeConfigSlot,
    inputContainerProps,
    extentHeaderContent,
    actionBarStyle,
    borderRadius,
    extraActionItems,
    dropdownPlacement,
    isConfigLoading = false,
    leftContent,
    placeholder,
    placeholderVariant,
    rightContent,
    sendAreaPrefix,
    variant,
  }) => {
    const { t } = useTranslation('chat');
    const layoutContainerRef = use(LayoutContainerContext);
    const [chatInputHeight, updateSystemStatus] = useGlobalStore((s) => [
      systemStatusSelectors.chatInputHeight(s),
      s.updateSystemStatus,
    ]);
    const hasContextSelections = useFileStore(fileChatSelectors.chatContextSelectionHasItem);
    const hasFiles = useFileStore(fileChatSelectors.chatUploadFileListHasItem);
    const [slashMenuRef, expand, showTypoBar, editor, leftActions] = useChatInputStore((s) => [
      s.slashMenuRef,
      s.expand,
      s.showTypoBar,
      s.editor,
      s.leftActions,
    ]);

    const chatKey = useChatStore(chatSelectors.currentChatKey);

    const setExpand = useChatInputStore((s) => s.setExpand);
    const skillDrop = useSkillDrop();
    const isChatGPTVariant = variant === 'chatgpt';
    const chatGPTVariantConfig = getConversationChatInputVariantConfig(variant);
    const defaultHeight = resolveConversationChatInputDefaultHeight(variant, chatInputHeight);

    useEffect(() => {
      if (editor) editor.focus();
      setExpand(false);
    }, [chatKey, editor, setExpand]);

    const shouldShowContextContainer =
      leftActions.flat().includes('fileUpload') || hasContextSelections || hasFiles;
    const contextContainerNode = shouldShowContextContainer && <ContextContainer />;

    const loadingLeftSlot = isConfigLoading ? (
      <Flexbox horizontal align="center" gap={6} paddingInline={4}>
        <Skeleton.Button active shape="circle" size="small" style={{ height: 28, width: 28 }} />
        <Skeleton.Button active shape="circle" size="small" style={{ height: 28, width: 28 }} />
      </Flexbox>
    ) : null;
    const loadingRightSlot = isConfigLoading ? (
      <Skeleton.Button
        active
        shape="round"
        size="small"
        style={{ height: 32, minWidth: 64, width: 64 }}
      />
    ) : null;

    const content = (
      <Flexbox
        className={cx(styles.container, expand && styles.fullscreen)}
        gap={isChatGPTVariant ? 6 : 8}
        paddingBlock={expand ? 0 : showFootnote ? '0 12px' : isChatGPTVariant ? '0 6px' : '0 8px'}
        onDragOver={skillDrop.onDragOver}
        onDrop={skillDrop.onDrop}
      >
        <ChatInput
          data-testid="chat-input"
          defaultHeight={defaultHeight}
          fullscreen={expand}
          maxHeight={320}
          minHeight={isChatGPTVariant ? chatGPTVariantConfig.minHeight : 36}
          resize={true}
          slashMenuRef={slashMenuRef}
          footer={
            <ChatInputActionBar
              left={
                loadingLeftSlot ??
                leftContent ?? (
                  <ActionBar
                    borderRadius={borderRadius}
                    dropdownPlacement={dropdownPlacement}
                    extraActionItems={extraActionItems}
                  />
                )
              }
              right={
                loadingRightSlot ??
                rightContent ??
                (sendAreaPrefix ? (
                  <Flexbox horizontal align={'center'} gap={6}>
                    {sendAreaPrefix}
                    <SendArea />
                  </Flexbox>
                ) : (
                  <SendArea />
                ))
              }
              style={{
                ...(isChatGPTVariant
                  ? {
                      minHeight: chatGPTVariantConfig.footerMinHeight,
                      paddingBlock: 0,
                      paddingInline: '10px 8px',
                    }
                  : { paddingRight: 8 }),
                ...actionBarStyle,
              }}
            />
          }
          header={
            <Flexbox gap={0}>
              {extentHeaderContent}
              {showTypoBar && <TypoBar />}
              {contextContainerNode}
            </Flexbox>
          }
          onSizeChange={(height) => {
            updateSystemStatus({ chatInputHeight: height });
          }}
          {...inputContainerProps}
          className={cx(
            isChatGPTVariant && styles.input_chatgpt,
            expand && styles.inputFullscreen,
            inputContainerProps?.className,
          )}
          classNames={{
            ...inputContainerProps?.classNames,
            body: cx(
              isChatGPTVariant && styles.inputBody_chatgpt,
              inputContainerProps?.classNames?.body,
            ),
            footer: cx(
              isChatGPTVariant && styles.inputFooter_chatgpt,
              inputContainerProps?.classNames?.footer,
            ),
            header: cx(
              isChatGPTVariant && styles.inputHeader_chatgpt,
              inputContainerProps?.classNames?.header,
            ),
          }}
        >
          <InputEditor
            defaultRows={isChatGPTVariant ? 1 : undefined}
            editorTheme={chatGPTVariantConfig.editorTheme}
            placeholder={placeholder}
            placeholderVariant={placeholderVariant}
          />
        </ChatInput>
        {runtimeConfigSlot ??
          (showRuntimeConfig &&
            (isChatGPTVariant ? (
              <div className={styles.runtimeConfig_chatgpt}>
                <RuntimeConfig />
              </div>
            ) : (
              <RuntimeConfig />
            )))}
        {showFootnote && !expand && (
          <Center style={{ pointerEvents: 'none', zIndex: 100 }}>
            <Text className={styles.footnote} type={'secondary'}>
              {t('input.disclaimer')}
            </Text>
          </Center>
        )}
      </Flexbox>
    );

    if (expand && layoutContainerRef.current)
      return createPortal(content, layoutContainerRef.current);

    return content;
  },
);

DesktopChatInput.displayName = 'DesktopChatInput';

export default DesktopChatInput;
