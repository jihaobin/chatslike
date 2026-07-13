import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import UserPanel from './index';

interface MockPopoverProps {
  children: ReactNode;
  classNames?: {
    root?: string;
  };
  placement?: string;
}

vi.mock('@lobehub/ui', () => ({
  Popover: ({ children, classNames, placement }: MockPopoverProps) => (
    <div
      data-placement={placement}
      data-root-class={classNames?.root || ''}
      data-testid="user-panel-popover"
    >
      {children}
    </div>
  ),
}));

vi.mock('antd-style', () => ({
  createStaticStyles: (
    factory: (utils: {
      css: (strings: TemplateStringsArray, ...values: unknown[]) => string;
    }) => Record<string, string>,
  ) =>
    factory({
      css: (strings, ...values) =>
        strings.reduce((result, part, index) => `${result}${part}${values[index] || ''}`, ''),
    }),
}));

vi.mock('./PanelContent', () => ({
  default: () => <div data-testid="panel-content" />,
}));

vi.mock('./PanelContentSkeleton', () => ({
  default: () => <div data-testid="panel-content-skeleton" />,
}));

vi.mock('./UpgradeBadge', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('./useNewVersion', () => ({
  useNewVersion: () => false,
}));

describe('UserPanel', () => {
  it('positions the popover from the trigger instead of forcing it to the sidebar origin', () => {
    render(
      <UserPanel>
        <button type="button">Account</button>
      </UserPanel>,
    );

    const popover = screen.getByTestId('user-panel-popover');

    expect(popover).toHaveAttribute('data-placement', 'bottomRight');
    expect(popover.getAttribute('data-root-class')).not.toContain('inset-inline-start');
    expect(popover.getAttribute('data-root-class')).not.toContain('inset-block-start');
  });
});
