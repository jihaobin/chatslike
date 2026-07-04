/**
 * @vitest-environment happy-dom
 */
import type { MarkdownProps } from '@lobehub/ui';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConversationMarkdownVariantProvider } from '@/features/Conversation/ConversationLayoutVariantContext';

import MarkdownMessage from '.';

const markdownCalls: MarkdownProps[] = [];

vi.mock('@lobehub/ui', () => ({
  Markdown: ({
    children,
    className,
    ...props
  }: MarkdownProps & { children?: ReactNode }) => {
    markdownCalls.push({ className, ...props } as MarkdownProps);

    return (
      <article className={className} data-testid="markdown">
        {children}
      </article>
    );
  },
}));

vi.mock('antd-style', () => ({
  createStaticStyles: () => ({
    chatgpt: 'chatgpt-prose',
    prose: 'default-prose',
  }),
  cx: (...values: unknown[]) => values.filter(Boolean).join(' '),
}));

vi.mock('@/store/user', () => ({
  useUserStore: (selector: (state: unknown) => unknown) => selector({}),
}));

vi.mock('@/store/user/selectors', () => ({
  userGeneralSettingsSelectors: {
    config: () => ({
      fontSize: 14,
      highlighterTheme: 'github-light',
      mermaidTheme: 'default',
    }),
  },
}));

const renderMarkdownMessage = (variant?: 'chatgpt') =>
  render(
    <ConversationMarkdownVariantProvider variant={variant}>
      <MarkdownMessage
        className="caller-class"
        componentProps={{
          highlight: { fullFeatured: false },
          mermaid: { fullFeatured: true },
        }}
      >
        # Heading
      </MarkdownMessage>
    </ConversationMarkdownVariantProvider>,
  );

describe('MarkdownMessage', () => {
  beforeEach(() => {
    markdownCalls.length = 0;
  });

  afterEach(() => {
    cleanup();
  });

  it('keeps default conversation markdown on user configured typography', () => {
    renderMarkdownMessage();

    expect(markdownCalls[0]).toMatchObject({
      className: 'caller-class',
      fontSize: 14,
      variant: 'chat',
    });
    expect(markdownCalls[0].lineHeight).toBeUndefined();
    expect(markdownCalls[0].marginMultiple).toBeUndefined();
    expect(markdownCalls[0].headerMultiple).toBeUndefined();
    expect(screen.getByTestId('markdown')).toHaveClass('caller-class');
    expect(screen.getByTestId('markdown')).not.toHaveClass('chatgpt-prose');
  });

  it('passes ChatGPT block-rhythm typography to the Markdown renderer', () => {
    renderMarkdownMessage('chatgpt');

    expect(markdownCalls[0]).toMatchObject({
      className: 'chatgpt-prose caller-class',
      fontSize: 17,
      headerMultiple: 0.52,
      lineHeight: 1.6,
      marginMultiple: 1.05,
      variant: 'chat',
    });
    expect(screen.getByTestId('markdown')).toHaveClass('chatgpt-prose');
    expect(screen.getByTestId('markdown')).toHaveClass('caller-class');
  });

  it('preserves caller component props while adding default themes', () => {
    renderMarkdownMessage('chatgpt');

    expect(markdownCalls[0].componentProps?.highlight).toMatchObject({
      fullFeatured: false,
      theme: 'github-light',
    });
    expect(markdownCalls[0].componentProps?.mermaid).toMatchObject({
      fullFeatured: true,
      theme: 'default',
    });
  });
});
