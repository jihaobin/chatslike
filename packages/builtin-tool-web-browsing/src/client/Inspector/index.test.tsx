/**
 * @vitest-environment happy-dom
 */
import type { UniformSearchResult } from '@lobechat/types';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CrawlSinglePageInspector } from './CrawlSinglePage';
import { SearchInspector } from './Search';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        'builtins.lobe-web-browsing.apiName.crawlSinglePage': '读取页面内容',
        'builtins.lobe-web-browsing.apiName.search': '搜索页面',
        'builtins.lobe-web-browsing.inspector.noResults': '无结果',
        'search.browsing.crawledPages': `浏览 ${options?.count} 个页面`,
        'search.browsing.webResults': `搜索到 ${options?.count} 个网页`,
      };
      return map[key] ?? key;
    },
  }),
}));

const createSearchResult = (overrides: Partial<UniformSearchResult> = {}): UniformSearchResult => ({
  content: '摘要',
  engines: ['Example'],
  parsedUrl: 'example.com',
  score: 1,
  title: '报道',
  url: 'https://example.com',
  ...overrides,
});

describe('web browsing inspectors', () => {
  it('renders completed search as compact web result event', () => {
    render(
      <SearchInspector
        apiName="search"
        args={{ query: 'HDC 2026' }}
        identifier="lobe-web-browsing"
        isLoading={false}
        result={{ content: 'done' }}
        pluginState={{
          costTime: 1,
          query: 'HDC 2026',
          resultNumbers: 2,
          results: [
            createSearchResult({ title: '报道 1', url: 'https://example.com/1' }),
            createSearchResult({ title: '报道 2', url: 'https://example.com/2' }),
          ],
        }}
      />,
    );

    expect(screen.getByText('搜索到 2 个网页')).toBeInTheDocument();
    expect(screen.queryByText('搜索页面:')).not.toBeInTheDocument();
  });

  it('renders completed page crawl as compact browsing event', () => {
    render(
      <CrawlSinglePageInspector
        apiName="crawlSinglePage"
        args={{ url: 'https://example.com/article' }}
        identifier="lobe-web-browsing"
        isLoading={false}
        result={{ content: 'done' }}
        pluginState={{
          results: [
            {
              crawler: 'jina',
              data: {
                content: '正文',
                title: 'Example article',
                url: 'https://example.com/article',
              },
              originalUrl: 'https://example.com/article',
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('浏览 1 个页面')).toBeInTheDocument();
    expect(screen.queryByText('读取页面内容:')).not.toBeInTheDocument();
  });
});
