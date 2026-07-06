import { Accordion, AccordionItem, ScrollArea } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import type { CSSProperties, ReactNode, RefObject } from 'react';
import { memo, useEffect, useState } from 'react';

import MarkdownMessage from '@/features/Conversation/Markdown';
import { useAutoScroll } from '@/hooks/useAutoScroll';
import { type ChatCitationItem } from '@/types/index';

import Title from './Title';

const styles = createStaticStyles(({ css, cssVar }) => ({
  contentScroll: css`
    max-height: min(40vh, 320px);
    padding-block: 2px 8px;
    padding-inline: 16px 8px;
    border-inline-start: 1px solid ${cssVar.colorBorderSecondary};

    font-size: 13px;
    line-height: 1.7;
    color: ${cssVar.colorTextSecondary};

    article * {
      color: ${cssVar.colorTextSecondary};
    }
  `,
  scrollRoot: css`
    border-radius: 0;
    background: transparent;
  `,
}));

interface ThinkingProps {
  citations?: ChatCitationItem[];
  content?: string | ReactNode;
  duration?: number;
  style?: CSSProperties;
  thinking?: boolean;
  thinkingAnimated?: boolean;
}

const Thinking = memo<ThinkingProps>((props) => {
  const { content, duration, thinking, citations, thinkingAnimated } = props;
  const [showDetail, setShowDetail] = useState(false);

  const { ref, handleScroll } = useAutoScroll<HTMLDivElement>({
    deps: [content, showDetail],
    enabled: thinking && showDetail,
    threshold: 120,
  });

  useEffect(() => {
    setShowDetail(!!thinking);
  }, [thinking]);

  return (
    <Accordion
      expandedKeys={showDetail ? ['thinking'] : []}
      gap={8}
      onExpandedChange={(keys) => setShowDetail(keys.length > 0)}
    >
      <AccordionItem
        itemKey={'thinking'}
        paddingBlock={4}
        paddingInline={4}
        title={<Title duration={duration} showDetail={showDetail} thinking={thinking} />}
      >
        <ScrollArea
          disableContentFit
          scrollFade
          className={styles.scrollRoot}
          contentProps={{
            style: {
              color: 'inherit',
              display: 'block',
              fontSize: 'inherit',
              gap: 0,
              lineHeight: 'inherit',
            },
          }}
          viewportProps={{
            className: styles.contentScroll,
            ref: ref as RefObject<HTMLDivElement>,
            onScroll: handleScroll,
          }}
        >
          {typeof content === 'string' ? (
            <MarkdownMessage
              animated={thinkingAnimated}
              citations={citations}
              variant={'chat'}
              style={{
                overflow: 'unset',
              }}
            >
              {content}
            </MarkdownMessage>
          ) : (
            content
          )}
        </ScrollArea>
      </AccordionItem>
    </Accordion>
  );
});

export default Thinking;
