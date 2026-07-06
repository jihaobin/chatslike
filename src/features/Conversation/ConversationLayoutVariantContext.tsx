'use client';

import { createContext, type ReactNode, use } from 'react';

import type { ConversationMarkdownVariant } from './ChatInput/layout';

const ConversationMarkdownVariantContext = createContext<ConversationMarkdownVariant | undefined>(
  undefined,
);

export const ConversationMarkdownVariantProvider = ({
  children,
  variant,
}: {
  children: ReactNode;
  variant?: ConversationMarkdownVariant;
}) => (
  <ConversationMarkdownVariantContext value={variant}>
    {children}
  </ConversationMarkdownVariantContext>
);

export const useConversationMarkdownVariant = () => use(ConversationMarkdownVariantContext);
