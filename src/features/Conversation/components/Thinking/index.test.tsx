/**
 * @vitest-environment happy-dom
 */
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import Thinking from './index';

vi.mock('@lobehub/ui', () => ({
  Accordion: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  AccordionItem: ({ children, title }: { children?: ReactNode; title?: ReactNode }) => (
    <section>
      {title}
      {children}
    </section>
  ),
  Block: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Flexbox: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Icon: () => null,
  ScrollArea: ({
    children,
    viewportProps,
  }: {
    children?: ReactNode;
    viewportProps?: Record<string, unknown>;
  }) => <div {...viewportProps}>{children}</div>,
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/features/Conversation/Markdown', () => ({
  default: ({ children }: { children?: string }) => <article>{children}</article>,
}));

vi.mock('@/hooks/useAutoScroll', () => ({
  useAutoScroll: () => ({ handleScroll: vi.fn(), ref: { current: null } }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        'Thinking.thinking': '思考中',
        'Thinking.thought': `已思考 ${options?.duration}`,
        'Thinking.thoughtWithDuration': '已思考',
      };
      return map[key] ?? key;
    },
  }),
}));

describe('Thinking', () => {
  it('renders thinking title and reasoning content', () => {
    render(<Thinking content="我需要先搜索公开资料。" duration={9000} thinking={false} />);

    expect(screen.getByText(/我需要先搜索公开资料/)).toBeInTheDocument();
    expect(screen.getByText(/9.0/)).toBeInTheDocument();
  });
});
