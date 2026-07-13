import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import User, { USER_DROPDOWN_ICON_ID } from './User';

vi.mock('@lobehub/ui', () => ({
  Block: ({ children, className }: { children: ReactNode; className?: string }) => (
    <button className={className} data-testid="user-trigger" type="button">
      {children}
    </button>
  ),
  Flexbox: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Icon: ({ id, size }: { id?: string; size?: number }) => (
    <span data-size={size} data-testid="fixed-user-icon" id={id} />
  ),
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock('antd-style', () => ({
  createStaticStyles: (
    factory: (utils: {
      css: (strings: TemplateStringsArray, ...values: unknown[]) => string;
      cssVar: Record<string, string>;
    }) => Record<string, string>,
  ) =>
    factory({
      css: (strings, ...values) =>
        strings.reduce((result, part, index) => `${result}${part}${values[index] || ''}`, ''),
      cssVar: {
        colorFillSecondary: '#f0f0f0',
        colorTextSecondary: '#666',
      },
    }),
}));

vi.mock('@/components/Branding', () => ({
  ProductLogo: () => <span data-testid="product-logo" />,
}));

vi.mock('@/features/User/UserAvatar', () => ({
  default: () => <span data-testid="uploaded-user-avatar" />,
}));

vi.mock('@/features/User/UserPanel', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/store/user', () => ({
  useUserStore: <T,>(selector: (state: unknown) => T) =>
    selector({
      isSignedIn: true,
      user: {
        fullName: 'Uploaded Name',
        username: 'uploaded-user',
      },
    }),
}));

describe('Home header user trigger', () => {
  it('renders only a fixed avatar icon without uploaded avatar, username, or dropdown chevron', () => {
    render(<User />);

    expect(screen.getByTestId('fixed-user-icon')).toBeInTheDocument();
    expect(screen.getByTestId('fixed-user-icon')).toHaveAttribute('data-size', '22');
    expect(document.getElementById(USER_DROPDOWN_ICON_ID)).toBeInTheDocument();
    expect(screen.queryByTestId('uploaded-user-avatar')).not.toBeInTheDocument();
    expect(screen.queryByText('Uploaded Name')).not.toBeInTheDocument();
    expect(screen.queryByText('uploaded-user')).not.toBeInTheDocument();
  });

  it('keeps extra breathing room around the trigger button', () => {
    render(<User />);

    const triggerClassName = screen.getByTestId('user-trigger').getAttribute('class') || '';

    expect(triggerClassName).toContain('width: 36px');
    expect(triggerClassName).toContain('height: 36px');
    expect(triggerClassName).toContain('margin-inline-end: 8px');
    expect(triggerClassName).toContain('margin-block-start: 4px');
  });
});
