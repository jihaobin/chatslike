import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SearchButton from './SearchButton';

const toggleCommandMenuMock = vi.hoisted(() => vi.fn());

vi.mock('@lobehub/ui', () => ({
  ActionIcon: ({ onClick, title }: { onClick?: () => void; title?: string }) => (
    <button type="button" onClick={onClick}>
      {title}
    </button>
  ),
}));

vi.mock('lucide-react', () => ({
  SearchIcon: () => null,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/const/layoutTokens', () => ({
  DESKTOP_HEADER_ICON_SMALL_SIZE: 24,
}));

vi.mock('@/store/global', () => ({
  useGlobalStore: (selector: (state: { toggleCommandMenu: (open: boolean) => void }) => unknown) =>
    selector({ toggleCommandMenu: toggleCommandMenuMock }),
}));

describe('Home sidebar search button', () => {
  beforeEach(() => {
    toggleCommandMenuMock.mockReset();
  });

  it('opens the command search menu', () => {
    render(<SearchButton />);

    fireEvent.click(screen.getByRole('button', { name: 'tab.search' }));

    expect(toggleCommandMenuMock).toHaveBeenCalledWith(true);
  });
});
