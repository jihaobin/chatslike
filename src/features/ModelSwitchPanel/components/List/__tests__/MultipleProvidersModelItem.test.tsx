/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type { HTMLAttributes, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { MultipleProvidersModelItem } from '../MultipleProvidersModelItem';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@lobehub/ui', () => ({
  DropdownMenuGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuGroupLabel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  DropdownMenuItemIcon: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  DropdownMenuItemLabel: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  DropdownMenuPopup: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  DropdownMenuPortal: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuPositioner: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuSubmenuRoot: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuSubmenuTrigger: ({
    children,
    className,
    onClick,
    style,
  }: HTMLAttributes<HTMLDivElement>) => (
    <div className={className} style={style} onClick={onClick}>
      {children}
    </div>
  ),
  Flexbox: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  ),
  Tag: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  menuSharedStyles: { item: 'item' },
}));

vi.mock('@/components/ModelSelect', () => ({
  ModelItemRender: ({
    displayName,
    proBadgeLabel,
  }: {
    displayName: string;
    proBadgeLabel?: string;
  }) => (
    <div>
      {displayName}
      {proBadgeLabel && <span data-testid="model-pro-badge">{proBadgeLabel}</span>}
    </div>
  ),
  ProviderItemRender: ({ name }: { name: string }) => <div>{name}</div>,
}));

vi.mock('../../ModelDetailPanel', () => ({
  default: ({ model, provider }: { model: string; provider: string }) => (
    <div data-testid="model-detail-panel">
      {provider}/{model}
    </div>
  ),
}));

describe('MultipleProvidersModelItem', () => {
  it('renders model detail panel even when info tags are hidden', () => {
    render(
      <MultipleProvidersModelItem
        activeKey="lobehub/gpt-5.4"
        newLabel="new"
        showInfoTag={false}
        data={{
          displayName: 'GPT-5.4',
          model: {
            abilities: {},
            displayName: 'GPT-5.4',
            id: 'gpt-5.4',
          } as any,
          providers: [
            { id: 'lobehub', model: { id: 'gpt-5.4' } as any, name: 'LobeHub' },
            { id: 'openai', model: { id: 'gpt-5.4' } as any, name: 'OpenAI' },
          ],
        }}
        onClose={vi.fn()}
        onModelChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId('model-detail-panel')).toHaveTextContent('lobehub/gpt-5.4');
    expect(screen.getByText('ModelSwitchPanel.useModelFrom')).toBeInTheDocument();
  });

  it('uses the restricted handler when the default provider is restricted', () => {
    const onClose = vi.fn();
    const onModelChange = vi.fn();
    const onRestrictedModelClick = vi.fn();

    render(
      <MultipleProvidersModelItem
        activeKey="anthropic/claude-opus-4-7"
        newLabel="new"
        proLabel="pro"
        showInfoTag={false}
        data={{
          displayName: 'Claude Opus 4.7',
          model: {
            abilities: {},
            displayName: 'Claude Opus 4.7',
            id: 'claude-opus-4-7',
          } as any,
          providers: [
            { id: 'lobehub', model: { id: 'claude-opus-4-7' } as any, name: 'LobeHub' },
            { id: 'anthropic', model: { id: 'claude-opus-4-7' } as any, name: 'Anthropic' },
          ],
        }}
        isModelRestricted={(modelId, providerId) =>
          modelId === 'claude-opus-4-7' && providerId === 'lobehub'
        }
        onClose={onClose}
        onModelChange={onModelChange}
        onRestrictedModelClick={onRestrictedModelClick}
      />,
    );

    fireEvent.click(screen.getByText('Claude Opus 4.7'));

    expect(onRestrictedModelClick).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onModelChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('model-pro-badge')).toHaveTextContent('pro');
  });

  it('uses the selected provider model id instead of the first grouped model id', () => {
    const onModelChange = vi.fn();

    render(
      <MultipleProvidersModelItem
        activeKey="amux/gpt-5.5"
        newLabel="new"
        showInfoTag={false}
        data={{
          displayName: 'GPT-5.5',
          model: {
            abilities: {},
            displayName: 'GPT-5.5',
            id: 'gpt-5.5-disabled',
          } as any,
          providers: [
            {
              id: 'amux-gpt-image-2',
              model: { id: 'gpt-5.5-disabled' } as any,
              name: 'AMUX Image',
            },
            { id: 'amux', model: { id: 'gpt-5.5' } as any, name: 'AMUX Cheap' },
          ],
        }}
        onClose={vi.fn()}
        onModelChange={onModelChange}
      />,
    );

    fireEvent.click(screen.getByText('AMUX Cheap'));

    expect(onModelChange).toHaveBeenCalledWith('gpt-5.5', 'amux');
  });
});
