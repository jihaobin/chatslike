import { type MarkdownProps } from '@lobehub/ui';
import { Markdown } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { memo } from 'react';

import { useUserStore } from '@/store/user';
import { userGeneralSettingsSelectors } from '@/store/user/selectors';

const proseStyles = createStaticStyles(({ css }) => ({
  prose: css`
    line-height: 1.8;

    p {
      margin-block-end: 1.25em;
    }

    li {
      margin-block-end: 0.6em;
    }
  `,
}));

const MarkdownMessage = memo<MarkdownProps>(({ children, componentProps, ...rest }) => {
  const { highlighterTheme, mermaidTheme, fontSize } = useUserStore(
    userGeneralSettingsSelectors.config,
  );

  return (
    <div className={proseStyles.prose}>
      <Markdown
        fontSize={fontSize}
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
