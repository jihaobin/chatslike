import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import CredTypeSelector from './CredTypeSelector';

vi.mock('@lobehub/ui', () => ({
  Flexbox: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('lucide-react', () => {
  const Icon = () => <svg data-testid="icon" />;

  return {
    File: Icon,
    Globe: Icon,
    Key: Icon,
    TerminalSquare: Icon,
  };
});

describe('CredTypeSelector', () => {
  it('shows all credential types by default', () => {
    render(<CredTypeSelector onSelect={vi.fn()} />);

    expect(screen.getByText('creds.types.kv-env')).toBeInTheDocument();
    expect(screen.getByText('creds.types.kv-header')).toBeInTheDocument();
    expect(screen.getByText('creds.types.oauth')).toBeInTheDocument();
    expect(screen.getByText('creds.types.file')).toBeInTheDocument();
  });

  it('hides KV credential types when KV creation is disabled', () => {
    render(<CredTypeSelector allowKV={false} onSelect={vi.fn()} />);

    expect(screen.queryByText('creds.types.kv-env')).not.toBeInTheDocument();
    expect(screen.queryByText('creds.types.kv-header')).not.toBeInTheDocument();
    expect(screen.getByText('creds.types.oauth')).toBeInTheDocument();
    expect(screen.getByText('creds.types.file')).toBeInTheDocument();
  });

  it('does not emit KV selection when KV creation is disabled', () => {
    const onSelect = vi.fn();
    render(<CredTypeSelector allowKV={false} onSelect={onSelect} />);

    fireEvent.click(screen.getByText('creds.types.oauth'));

    expect(onSelect).toHaveBeenCalledWith('oauth');
    expect(onSelect).not.toHaveBeenCalledWith('kv-env');
    expect(onSelect).not.toHaveBeenCalledWith('kv-header');
  });
});
