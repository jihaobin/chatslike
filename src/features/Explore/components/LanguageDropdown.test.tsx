import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import LanguageDropdown from './LanguageDropdown';

const mocks = vi.hoisted(() => ({
  globalState: {
    status: {
      language: 'auto' as const,
    },
    switchLocale: vi.fn(),
  },
}));

vi.mock('@lobehub/ui', () => ({
  DropdownMenu: ({
    children,
    items = [],
  }: {
    children: ReactNode;
    items?: Array<{ key: string; label: ReactNode; onCheckedChange?: (checked: boolean) => void }>;
  }) => (
    <div>
      <div data-testid="trigger">{children}</div>
      <div data-testid="items">
        {items.map((item) => (
          <button key={item.key} type="button" onClick={() => item.onCheckedChange?.(true)}>
            {item.label}
          </button>
        ))}
      </div>
    </div>
  ),
  Flexbox: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Icon: ({ icon: IconComp }: { icon: unknown }) => (
    <span>{typeof IconComp === 'function' ? 'icon' : 'icon'}</span>
  ),
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock('lucide-react', () => ({
  ChevronDownIcon: () => null,
  GlobeIcon: () => null,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: {
      language: 'en-US',
      resolvedLanguage: 'en-US',
    },
    t: (key: string) => key,
  }),
}));

vi.mock('@/store/global', () => ({
  useGlobalStore: (selector: (state: typeof mocks.globalState) => unknown) =>
    selector(mocks.globalState),
}));

beforeEach(() => {
  mocks.globalState.status.language = 'auto';
  mocks.globalState.switchLocale.mockReset();
});

describe('LanguageDropdown', () => {
  it('includes follow-system and supported locale items', () => {
    render(<LanguageDropdown />);

    expect(screen.getByRole('button', { name: 'settingCommon.lang.autoMode' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '简体中文 lang.zh-CN' })).toBeInTheDocument();
  });

  it('switches to a locale through the existing i18n action', () => {
    render(<LanguageDropdown />);

    fireEvent.click(screen.getByRole('button', { name: '简体中文 lang.zh-CN' }));

    expect(mocks.globalState.switchLocale).toHaveBeenCalledWith('zh-CN');
  });
});
