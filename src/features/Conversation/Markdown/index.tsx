import { type MarkdownProps } from '@lobehub/ui';
import { Markdown } from '@lobehub/ui';
import { createStaticStyles, cx } from 'antd-style';
import { memo } from 'react';

import { getConversationMarkdownVariantConfig } from '@/features/Conversation/ChatInput/layout';
import { useConversationMarkdownVariant } from '@/features/Conversation/ConversationLayoutVariantContext';
import { useUserStore } from '@/store/user';
import { userGeneralSettingsSelectors } from '@/store/user/selectors';

const proseStyles = createStaticStyles(({ css, cssVar }) => ({
  chatgpt: css`
    color: ${cssVar.colorText};

    p {
      margin-block: 0 1.05em;
      letter-spacing: 0;
    }

    h1,
    h2,
    h3,
    h4,
    h5,
    h6 {
      margin-block: 1.35em 0.72em;
      font-weight: 700;
      line-height: 1.25;
      letter-spacing: 0;
    }

    h1 {
      font-size: 1.8em;
    }

    h2 {
      font-size: 1.5em;
    }

    h3 {
      font-size: 1.26em;
    }

    h4,
    h5,
    h6 {
      font-size: 1em;
    }

    h1:first-child,
    h2:first-child,
    h3:first-child,
    h4:first-child,
    h5:first-child,
    h6:first-child {
      margin-block-start: 0;
    }

    ol,
    ul {
      margin-block: 0.65em 1.05em;
      padding-inline-start: 1.35em;
    }

    li {
      margin-block: 0.33em;
      padding-inline-start: 0.15em;
    }

    li > p {
      margin-block: 0.18em 0.45em;
    }

    p:last-child {
      margin-block-end: 0;
    }

    li > p:last-child {
      margin-block-end: 0.45em;
    }

    blockquote {
      margin-block: 1em 1.2em;
      padding-inline-start: 18px;
      border-inline-start: 4px solid ${cssVar.colorBorder};

      font-weight: 600;
      color: ${cssVar.colorText};
    }

    blockquote > :last-child {
      margin-block-end: 0;
    }

    hr {
      margin-block: 1.75em 1.8em;
      border: 0;
      border-block-start: 1px solid ${cssVar.colorBorderSecondary};
    }

    code:not(pre code) {
      border: 0;
      border-radius: 4px;
      background: ${cssVar.colorFillSecondary};
    }

    pre {
      margin-block: 1em 1.15em;
    }

    table {
      margin-block: 1em 1.15em;
    }
  `,
  prose: css`
    p {
      margin-block-end: 1.25em;
    }

    li {
      margin-block-end: 0.6em;
    }
  `,
}));

const MarkdownMessage = memo<MarkdownProps>(({ children, className, componentProps, ...rest }) => {
  const { highlighterTheme, mermaidTheme, fontSize } = useUserStore(
    userGeneralSettingsSelectors.config,
  );
  const markdownVariant = useConversationMarkdownVariant();
  const markdownVariantConfig = getConversationMarkdownVariantConfig(markdownVariant);
  const isChatGPTVariant = markdownVariant === 'chatgpt';

  return (
    <div className={cx(!isChatGPTVariant && proseStyles.prose)}>
      <Markdown
        className={cx(isChatGPTVariant && proseStyles.chatgpt, className)}
        fontSize={markdownVariantConfig.fontSize ?? fontSize}
        headerMultiple={markdownVariantConfig.headerMultiple}
        lineHeight={markdownVariantConfig.lineHeight}
        marginMultiple={markdownVariantConfig.marginMultiple}
        variant={'chat'}
        componentProps={{
          ...componentProps,
          highlight: {
            fullFeatured: true,
            theme: highlighterTheme,
            ...componentProps?.highlight,
          },
          mermaid: { fullFeatured: false, theme: mermaidTheme, ...componentProps?.mermaid },
        }}
        {...rest}
      >
        {children}
      </Markdown>
    </div>
  );
});

export default MarkdownMessage;
