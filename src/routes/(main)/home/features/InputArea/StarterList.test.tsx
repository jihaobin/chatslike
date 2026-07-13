import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentType, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import StarterList from './StarterList';

const navigate = vi.hoisted(() => vi.fn());

vi.mock('@lobehub/ui', () => ({
  Button: ({
    children,
    icon,
    onClick,
  }: {
    children: ReactNode;
    icon?: ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {icon}
      {children}
    </button>
  ),
  Center: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Icon: ({ icon: Icon }: { icon: ComponentType }) => <Icon />,
}));

vi.mock('antd-style', () => ({
  createStaticStyles: () => ({
    button: 'button',
  }),
  cx: (...classes: string[]) => classes.filter(Boolean).join(' '),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/hooks/useStableNavigate', () => ({
  useStableNavigate: () => navigate,
}));

describe('Home generation shortcuts', () => {
  it('shows only image and video generation entries under the home input', () => {
    render(<StarterList />);

    expect(screen.getByRole('button', { name: /starter.generateImage/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /starter.generateVideo/ })).toBeInTheDocument();
    expect(screen.queryByText('starter.deepseekV4Pro')).not.toBeInTheDocument();
    expect(screen.queryByText('starter.newLabel')).not.toBeInTheDocument();
  });

  it('opens the existing image and video generation pages', () => {
    render(<StarterList />);

    fireEvent.click(screen.getByRole('button', { name: /starter.generateImage/ }));
    fireEvent.click(screen.getByRole('button', { name: /starter.generateVideo/ }));

    expect(navigate).toHaveBeenNthCalledWith(1, '/home/image?model=gpt-image-2');
    expect(navigate).toHaveBeenNthCalledWith(2, '/home/video?model=dreamina-seedance-2-0-260128');
  });
});
