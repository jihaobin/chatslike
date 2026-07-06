/**
 * @vitest-environment happy-dom
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import SearchItem from './index';

vi.mock('@/components/WebFavicon', () => ({
  default: ({ title }: { title?: string }) => <span>{title?.slice(0, 1) || 'F'}</span>,
}));

describe('Portal SearchItem', () => {
  it('renders source, title, summary and external link', () => {
    render(
      <SearchItem
        category="general"
        content="阿里云在峰会上宣布 Agent 化升级，同步推出多项基础设施。"
        engines={['QQ News']}
        parsedUrl="news.qq.com"
        score={1}
        title="阿里云峰会：发布真武M890"
        url="https://news.qq.com/a"
      />,
    );

    const link = screen.getByRole('link', { name: /阿里云峰会/ });
    expect(link).toHaveAttribute('href', 'https://news.qq.com/a');
    expect(link).toHaveAttribute('target', '_blank');
    expect(screen.getByText('QQ News')).toBeInTheDocument();
    expect(screen.getByText(/Agent 化升级/)).toBeInTheDocument();
  });
});
