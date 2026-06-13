import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import OnBoardingContainer from './index';

vi.mock('@/features/User/UserPanel/LangButton', () => ({
  default: () => <div>Lang Button</div>,
}));

vi.mock('@/features/User/UserPanel/ThemeButton', () => ({
  default: () => <div>Theme Button</div>,
}));

vi.mock('@/hooks/useIsDark', () => ({
  useIsDark: () => false,
}));

const renderAt = (initialPath: string) =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <OnBoardingContainer>
        <div>Onboarding Content</div>
      </OnBoardingContainer>
    </MemoryRouter>,
  );

afterEach(() => {
  cleanup();
});

describe('OnBoardingContainer', () => {
  it('renders the branding header and onboarding content', () => {
    renderAt('/onboarding');

    expect(screen.getByText('Lang Button')).toBeInTheDocument();
    expect(screen.getByText('Theme Button')).toBeInTheDocument();
    expect(screen.getByText('Onboarding Content')).toBeInTheDocument();
  });

  it('renders the same chrome on the classic branch path', () => {
    renderAt('/onboarding/classic');

    expect(screen.getByText('Onboarding Content')).toBeInTheDocument();
  });
});
