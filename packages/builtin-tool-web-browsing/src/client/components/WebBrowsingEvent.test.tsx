/**
 * @vitest-environment happy-dom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SourceAvatarCluster, WebBrowsingEvent, WebBrowsingLinkList } from './WebBrowsingEvent';

describe('WebBrowsingEvent components', () => {
  it('renders compact source avatars from labels', () => {
    render(<SourceAvatarCluster sources={['QQ News', '网易', '北京商报']} />);

    expect(screen.getByText('Q')).toBeInTheDocument();
    expect(screen.getByText('网')).toBeInTheDocument();
    expect(screen.getByText('北')).toBeInTheDocument();
  });

  it('renders external result links', () => {
    render(
      <WebBrowsingLinkList
        items={[
          { title: '阿里云峰会：发布真武M890', url: 'https://news.qq.com/a' },
          { title: '面向 Agentic 时代', url: 'https://example.com/agentic' },
        ]}
      />,
    );

    const first = screen.getByRole('link', { name: /阿里云峰会/ });
    expect(first).toHaveAttribute('href', 'https://news.qq.com/a');
    expect(first).toHaveAttribute('target', '_blank');
    expect(first).toHaveAttribute('rel', 'noreferrer');
  });

  it('calls onShowMore from the compact show more button', async () => {
    const onShowMore = vi.fn();
    render(
      <WebBrowsingEvent
        iconLabel="⌕"
        showMoreLabel="查看全部"
        title="搜索到 37 个网页"
        onShowMore={onShowMore}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: '查看全部' }));
    expect(onShowMore).toHaveBeenCalledTimes(1);
  });
});
