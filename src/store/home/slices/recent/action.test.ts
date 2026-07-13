import { describe, expect, it, vi } from 'vitest';

import type { HomeStore } from '@/store/home/store';
import type { StoreSetter } from '@/store/types';

import { RecentActionImpl } from './action';
import { DEFAULT_RECENT_LIST_LIMIT, RECENT_LIST_LOAD_STEP } from './initialState';

vi.mock('@/libs/swr', () => ({
  mutate: vi.fn(),
  useClientDataSWRWithSync: vi.fn(),
}));

const createAction = (initialState: Partial<HomeStore>) => {
  const homeState: Partial<HomeStore> = { ...initialState };

  const setState: StoreSetter<HomeStore> = ((partial) => {
    if (typeof partial === 'function') {
      Object.assign(homeState, partial(homeState as HomeStore));
      return;
    }
    Object.assign(homeState, partial);
  }) as StoreSetter<HomeStore>;

  const action = new RecentActionImpl(setState, () => homeState as HomeStore);

  return { action, homeState };
};

describe('RecentActionImpl', () => {
  describe('loadMoreRecents', () => {
    it('increases the recent list limit when more rows are available', () => {
      const { action, homeState } = createAction({
        hasMoreRecents: true,
        recentListLimit: DEFAULT_RECENT_LIST_LIMIT,
      });

      action.loadMoreRecents();

      expect(homeState.recentListLimit).toBe(DEFAULT_RECENT_LIST_LIMIT + RECENT_LIST_LOAD_STEP);
    });

    it('does not change the recent list limit when all rows are loaded', () => {
      const { action, homeState } = createAction({
        hasMoreRecents: false,
        recentListLimit: DEFAULT_RECENT_LIST_LIMIT,
      });

      action.loadMoreRecents();

      expect(homeState.recentListLimit).toBe(DEFAULT_RECENT_LIST_LIMIT);
    });
  });
});
