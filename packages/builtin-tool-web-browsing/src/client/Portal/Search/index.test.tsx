/**
 * @vitest-environment happy-dom
 */
import type { UniformSearchResponse } from '@lobechat/types';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useChatStore } from '@/store/chat';
import type { ChatStore } from '@/store/chat/store';

import SearchPortal from './index';

vi.mock('@/store/chat', () => ({
  useChatStore: vi.fn(),
}));

vi.mock('@/store/chat/selectors', () => ({
  chatToolSelectors: {
    isSearXNGSearching: () => () => false,
  },
}));

vi.mock('react-virtuoso', () => ({
  Virtuoso: ({
    data,
    itemContent,
  }: {
    data: Array<{ url: string }>;
    itemContent: (index: number, item: { url: string }) => ReactNode;
  }) => (
    <div>
      {data.map((item, index) => (
        <div key={item.url}>{itemContent(index, item)}</div>
      ))}
    </div>
  ),
}));

vi.mock('@/components/WebFavicon', () => ({
  default: ({ title }: { title?: string }) => <span>{title?.slice(0, 1) || 'F'}</span>,
}));

const mockUseChatStore = vi.mocked(useChatStore);

const response: UniformSearchResponse = {
  costTime: 1,
  query: '阿里云峰会',
  resultNumbers: 1,
  results: [
    {
      content: '阿里云在峰会上宣布 Agent 化升级。',
      engines: ['QQ News'],
      parsedUrl: 'news.qq.com',
      score: 1,
      title: '阿里云峰会：发布真武M890',
      url: 'https://news.qq.com/a',
    },
  ],
};

describe('Portal Search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseChatStore.mockImplementation((selector) => selector({} as unknown as ChatStore));
  });

  it('renders result list directly without the search configuration panel', () => {
    render(
      <SearchPortal
        messageId="msg-search"
        query={{ query: '阿里云峰会', searchEngines: ['bing'] }}
        response={response}
      />,
    );

    expect(screen.getByText('阿里云峰会：发布真武M890')).toBeInTheDocument();
    expect(screen.getByText('QQ News')).toBeInTheDocument();
    expect(screen.queryByText('搜索引擎：')).not.toBeInTheDocument();
    expect(screen.queryByText('搜索类别：')).not.toBeInTheDocument();
    expect(screen.queryByText('时间范围：')).not.toBeInTheDocument();
  });
});
