export const CHATGPT_CONVERSATION_WIDTH = 768;

export type ConversationLayoutVariant = 'chatgpt';

export type ConversationChatInputVariant = 'chatgpt';
export type ConversationMarkdownVariant = 'chatgpt';

interface ConversationMarkdownVariantConfig {
  fontSize?: number;
  headerMultiple?: number;
  lineHeight?: number;
  marginMultiple?: number;
}

interface ConversationChatInputVariantConfig {
  defaultHeight?: number;
  editorTheme?: {
    fontSize: number;
    lineHeight: number;
    marginMultiple: number;
  };
  footerMinHeight?: number;
  minHeight?: number;
  runtimeConfigVariant?: 'inline';
}

interface ConversationLayoutVariantConfig {
  chatInputVariant?: ConversationChatInputVariant;
  contentWidth?: number;
  markdownVariant?: ConversationMarkdownVariant;
}

export const getConversationMarkdownVariantConfig = (
  variant?: ConversationMarkdownVariant,
): ConversationMarkdownVariantConfig => {
  if (variant === 'chatgpt') {
    return {
      fontSize: 17,
      headerMultiple: 0.52,
      lineHeight: 1.6,
      marginMultiple: 1.05,
    };
  }

  return {};
};

export const getConversationChatInputVariantConfig = (
  variant?: ConversationChatInputVariant,
): ConversationChatInputVariantConfig => {
  if (variant === 'chatgpt') {
    return {
      defaultHeight: 32,
      editorTheme: {
        fontSize: 16,
        lineHeight: 1.42,
        marginMultiple: 0.6,
      },
      footerMinHeight: 38,
      minHeight: 32,
      runtimeConfigVariant: 'inline',
    };
  }

  return {};
};

export const resolveConversationChatInputDefaultHeight = (
  variant: ConversationChatInputVariant | undefined,
  storedHeight: number | undefined,
) => {
  if (variant === 'chatgpt') {
    return getConversationChatInputVariantConfig(variant).defaultHeight;
  }

  return storedHeight || 32;
};

export const getConversationLayoutVariantConfig = (
  variant?: ConversationLayoutVariant,
): ConversationLayoutVariantConfig => {
  if (variant === 'chatgpt') {
    return {
      chatInputVariant: 'chatgpt',
      contentWidth: CHATGPT_CONVERSATION_WIDTH,
      markdownVariant: 'chatgpt',
    };
  }

  return {
    chatInputVariant: undefined,
    contentWidth: undefined,
    markdownVariant: undefined,
  };
};
