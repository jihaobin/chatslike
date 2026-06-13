import { describe, expect, it } from 'vitest';

import type { FooterPromotionContext } from './promotionPipeline';
import { resolveFooterPromotionState } from './promotionPipeline';

const createContext = (overrides: Partial<FooterPromotionContext> = {}) => ({
  isProductHuntNotificationRead: false,
  isWithinProductHuntWindow: true,
  serverConfigInit: true,
  ...overrides,
});

describe('resolveFooterPromotionState', () => {
  it('auto-shows the product hunt card within the window before it is read', () => {
    expect(resolveFooterPromotionState(createContext())).toEqual({
      shouldAutoShowProductHuntCard: true,
      shouldShowProductHuntMenuEntry: true,
    });
  });

  it('keeps the product hunt menu entry while suppressing auto-open after read', () => {
    expect(
      resolveFooterPromotionState(createContext({ isProductHuntNotificationRead: true })),
    ).toEqual({
      shouldAutoShowProductHuntCard: false,
      shouldShowProductHuntMenuEntry: true,
    });
  });

  it('returns an empty state when outside the product hunt window', () => {
    expect(
      resolveFooterPromotionState(createContext({ isWithinProductHuntWindow: false })),
    ).toEqual({
      shouldAutoShowProductHuntCard: false,
      shouldShowProductHuntMenuEntry: false,
    });
  });
});
