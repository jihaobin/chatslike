/**
 * @vitest-environment happy-dom
 */
import type { UniformSearchResult } from '@lobechat/types';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useChatStore } from '@/store/chat';
import type { ChatStore } from '@/store/chat/store';

import SearchResult from './index';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        'search.browsing.showAll': '查看全部',
        'search.browsing.webResults': `搜索到 ${options?.count} 个网页`,
        'search.emptyResult': '没有找到结果',
      };
      return map[key] ?? key;
    },
  }),
}));

vi.mock('@/hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}));

vi.mock('@/store/chat', () => ({
  useChatStore: vi.fn(),
}));

vi.mock('@/store/chat/selectors', () => ({
  chatToolSelectors: {
    isSearXNGSearching: () => () => false,
  },
}));

const openToolUIMock = vi.fn();

const mockUseChatStore = vi.mocked(useChatStore);

const createSearchResult = (overrides: Partial<UniformSearchResult> = {}): UniformSearchResult => ({
  content: '摘要',
  engines: ['Example'],
  parsedUrl: 'example.com',
  score: 1,
  title: '结果',
  url: 'https://example.com',
  ...overrides,
});

describe('SearchResult compact event', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseChatStore.mockImplementation((selector) =>
      selector({
        openToolUI: openToolUIMock,
      } as unknown as ChatStore),
    );
  });

  it('renders compact search event with result links', () => {
    render(
      <SearchResult
        args={{ query: '阿里云峰会', searchEngines: ['google'] }}
        editing={false}
        messageId="msg-search"
        setEditing={vi.fn()}
        pluginState={{
          costTime: 1,
          query: '阿里云峰会',
          resultNumbers: 2,
          results: [
            createSearchResult({
              content: '摘要 1',
              engines: ['QQ News'],
              parsedUrl: 'news.qq.com',
              title: '阿里云峰会：发布真武M890',
              url: 'https://news.qq.com/a',
            }),
            createSearchResult({
              content: '摘要 2',
              engines: ['网易'],
              parsedUrl: 'www.163.com',
              title: '面向 Agentic 时代',
              url: 'https://www.163.com/a',
            }),
          ],
        }}
      />,
    );

    expect(screen.getByText('搜索到 2 个网页')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /阿里云峰会/ })).toHaveAttribute(
      'href',
      'https://news.qq.com/a',
    );
    expect(screen.getByText('Q')).toBeInTheDocument();
    expect(screen.getByText('网')).toBeInTheDocument();
  });

  it('opens tool UI from show all', async () => {
    render(
      <SearchResult
        args={{ query: '阿里云峰会', searchEngines: ['google'] }}
        editing={false}
        messageId="msg-search"
        setEditing={vi.fn()}
        pluginState={{
          costTime: 1,
          query: '阿里云峰会',
          resultNumbers: 6,
          results: Array.from({ length: 6 }).map((_, index) =>
            createSearchResult({
              content: `摘要 ${index}`,
              engines: ['QQ News'],
              parsedUrl: 'example.com',
              title: `结果 ${index}`,
              url: `https://example.com/${index}`,
            }),
          ),
        }}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: '查看全部' }));
    expect(openToolUIMock).toHaveBeenCalledWith('msg-search', 'lobe-web-browsing');
  });
});
