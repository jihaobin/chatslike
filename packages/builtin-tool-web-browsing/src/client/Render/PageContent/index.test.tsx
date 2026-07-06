/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useChatStore } from '@/store/chat';
import type { ChatStore } from '@/store/chat/store';

import PagesContent from './index';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        'search.browsing.crawledPages': `浏览 ${options?.count} 个页面`,
        'search.browsing.openOriginal': '打开原网页',
        'search.browsing.readingPage': '读取页面内容',
        'search.crawPages.crawling': '链接识别中',
      };
      return map[key] ?? key;
    },
  }),
}));

vi.mock('@/store/chat', () => ({
  useChatStore: vi.fn(),
}));

const openToolUIMock = vi.fn();
const togglePageContentMock = vi.fn();
const mockUseChatStore = vi.mocked(useChatStore);

describe('PagesContent compact crawl event', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseChatStore.mockImplementation((selector) =>
      selector({
        openToolUI: openToolUIMock,
        togglePageContent: togglePageContentMock,
      } as unknown as ChatStore),
    );
  });

  it('renders loading rows while urls are pending', () => {
    render(<PagesContent messageId="msg-crawl" urls={['https://pending.example.com']} />);

    expect(screen.getByText(/读取页面内容/)).toBeInTheDocument();
    expect(screen.getByText('https://pending.example.com')).toBeInTheDocument();
  });

  it('opens drawer and selects original url when a crawled page is clicked', async () => {
    render(
      <PagesContent
        messageId="msg-crawl"
        urls={['https://news.qq.com/a']}
        results={[
          {
            crawler: 'jina',
            data: {
              content: '正文',
              description: '摘要',
              title: '阿里云峰会发布真武M890',
              url: 'https://news.qq.com/a',
            },
            originalUrl: 'https://news.qq.com/a',
          },
        ]}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /阿里云峰会发布真武M890/ }));
    expect(openToolUIMock).toHaveBeenCalledWith('msg-crawl', 'lobe-web-browsing');
    expect(togglePageContentMock).toHaveBeenCalledWith('https://news.qq.com/a');
  });

  it('does not open drawer when external link is clicked', () => {
    render(
      <PagesContent
        messageId="msg-crawl"
        urls={['https://example.com/article']}
        results={[
          {
            crawler: 'jina',
            data: {
              content: '正文',
              description: '摘要',
              title: '外链测试',
              url: 'https://example.com/article',
            },
            originalUrl: 'https://example.com/article',
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('link', { name: /打开原网页/ }));
    expect(openToolUIMock).not.toHaveBeenCalled();
    expect(togglePageContentMock).not.toHaveBeenCalled();
  });

  it('renders compact error rows', () => {
    render(
      <PagesContent
        messageId="msg-crawl"
        urls={['https://example.com/error']}
        results={[
          {
            crawler: 'jina',
            data: {
              content: '抓取失败',
              errorMessage: '页面无法访问',
              errorType: 'fetchError',
              url: 'https://example.com/error',
            },
            originalUrl: 'https://example.com/error',
          },
        ]}
      />,
    );

    expect(screen.getByText('浏览 1 个页面')).toBeInTheDocument();
    expect(screen.getByText('页面无法访问')).toBeInTheDocument();
  });
});
