import { describe, expect, it } from 'vitest';

import {
  CHATGPT_CONVERSATION_WIDTH,
  getConversationChatInputVariantConfig,
  getConversationLayoutVariantConfig,
  getConversationMarkdownVariantConfig,
  resolveConversationChatInputDefaultHeight,
} from './layout';

describe('conversation chat input layout variant', () => {
  it('uses a 768px centered rail for the ChatGPT-like variant', () => {
    expect(getConversationLayoutVariantConfig('chatgpt')).toMatchObject({
      chatInputVariant: 'chatgpt',
      contentWidth: CHATGPT_CONVERSATION_WIDTH,
      markdownVariant: 'chatgpt',
    });
  });

  it('keeps the default project chrome unless the variant is explicitly enabled', () => {
    expect(getConversationLayoutVariantConfig()).toEqual({
      chatInputVariant: undefined,
      contentWidth: undefined,
      markdownVariant: undefined,
    });
  });

  it('uses ChatGPT-like markdown typography with block rhythm instead of dense prose', () => {
    expect(getConversationMarkdownVariantConfig('chatgpt')).toMatchObject({
      fontSize: 17,
      headerMultiple: 0.52,
      lineHeight: 1.6,
      marginMultiple: 1.05,
    });
  });

  it('uses a compact editor theme for the ChatGPT-like composer without changing actions', () => {
    expect(getConversationChatInputVariantConfig('chatgpt')).toMatchObject({
      defaultHeight: 32,
      editorTheme: {
        fontSize: 16,
        lineHeight: 1.42,
        marginMultiple: 0.6,
      },
      footerMinHeight: 38,
      minHeight: 32,
      runtimeConfigVariant: 'inline',
    });
  });

  it('keeps the compact ChatGPT-like composer tall enough to avoid a first-line scrollbar', () => {
    const config = getConversationChatInputVariantConfig('chatgpt');
    const oneLineContentHeight = config.editorTheme!.fontSize * config.editorTheme!.lineHeight + 8;

    expect(config.minHeight).toBeGreaterThanOrEqual(Math.ceil(oneLineContentHeight));
    expect(config.defaultHeight).toBeGreaterThanOrEqual(config.minHeight!);
  });

  it('does not inject markdown or composer overrides for the default layout', () => {
    expect(getConversationMarkdownVariantConfig()).toEqual({});
    expect(getConversationChatInputVariantConfig()).toEqual({});
  });

  it('does not let the legacy stored composer height mask the ChatGPT-like composer', () => {
    expect(resolveConversationChatInputDefaultHeight('chatgpt', 64)).toBe(32);
    expect(resolveConversationChatInputDefaultHeight(undefined, 64)).toBe(64);
  });
});
