/**
 * @vitest-environment happy-dom
 */
import type * as LobehubUiModule from '@lobehub/ui';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import PageContent from './index';

vi.mock('@lobehub/ui', async (importOriginal) => {
  const original = await importOriginal<typeof LobehubUiModule>();
  return {
    ...original,
    Markdown: ({ children }: { children?: string }) => <article>{children}</article>,
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'search.crawPages.detail.preview': '预览',
        'search.crawPages.detail.raw': '原始文本',
        'search.crawPages.meta.crawler': '抓取模式',
        'search.crawPages.meta.words': '字符数',
      };
      return map[key] ?? key;
    },
  }),
}));

describe('Portal PageContent', () => {
  it('renders article preview without meta strip or preview/raw switch', () => {
    render(
      <PageContent
        messageId="msg-page"
        result={{
          crawler: 'jina',
          data: {
            content: '## A new visual style\nHarmonyOS 7 article body',
            description: 'Huawei has unveiled HarmonyOS 7.',
            title: 'Huawei launches HarmonyOS 7',
            url: 'https://example.com/harmonyos-7',
          },
          originalUrl: 'https://example.com/harmonyos-7',
        }}
      />,
    );

    expect(screen.getByText('Huawei launches HarmonyOS 7')).toBeInTheDocument();
    expect(screen.getByText(/HarmonyOS 7 article body/)).toBeInTheDocument();
    expect(screen.queryByText('字符数')).not.toBeInTheDocument();
    expect(screen.queryByText('抓取模式')).not.toBeInTheDocument();
    expect(screen.queryByText('预览')).not.toBeInTheDocument();
    expect(screen.queryByText('原始文本')).not.toBeInTheDocument();
  });
});
