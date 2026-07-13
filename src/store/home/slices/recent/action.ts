import isEqual from 'fast-deep-equal';
import { type SWRResponse } from 'swr';

import { mutate, useClientDataSWRWithSync } from '@/libs/swr';
import { type RecentItem } from '@/server/routers/lambda/recent';
import { recentService } from '@/services/recent';
import { type HomeStore } from '@/store/home/store';
import { type StoreSetter } from '@/store/types';
import { setNamespace } from '@/utils/storeDebug';

import { DEFAULT_RECENT_LIST_LIMIT, RECENT_LIST_LOAD_STEP } from './initialState';

const n = setNamespace('recent');

const FETCH_RECENTS_KEY = 'fetchRecents';
// Poll on a short cadence so users see new items without manual refresh.
// SWR pauses when the tab is backgrounded.
const RECENTS_REFRESH_INTERVAL = 10_000;

type Setter = StoreSetter<HomeStore>;
export const createRecentSlice = (set: Setter, get: () => HomeStore, _api?: unknown) =>
  new RecentActionImpl(set, get, _api);

export class RecentActionImpl {
  readonly #get: () => HomeStore;
  readonly #set: Setter;

  constructor(set: Setter, get: () => HomeStore, _api?: unknown) {
    void _api;
    this.#set = set;
    this.#get = get;
  }

  loadMoreRecents = (): void => {
    const { hasMoreRecents, recentListLimit } = this.#get();
    if (!hasMoreRecents) return;

    this.#set(
      { recentListLimit: recentListLimit + RECENT_LIST_LOAD_STEP },
      false,
      n('loadMoreRecents'),
    );
  };

  updateRecentTitle = (id: string, title: string): void => {
    const recents = this.#get().recents.map((item) => (item.id === id ? { ...item, title } : item));
    this.#set({ recents }, false, n('updateRecentTitle'));
  };

  refreshRecents = async (): Promise<void> => {
    await mutate((key: unknown) => Array.isArray(key) && key[0] === FETCH_RECENTS_KEY);
  };

  useFetchRecents = (
    isLogin: boolean | undefined,
    limit: number = DEFAULT_RECENT_LIST_LIMIT,
  ): SWRResponse<RecentItem[]> => {
    return useClientDataSWRWithSync<RecentItem[]>(
      isLogin === true ? [FETCH_RECENTS_KEY, isLogin, limit] : null,
      async () => recentService.getAll(limit + 1),
      {
        onData: (data) => {
          const recents = data.slice(0, limit);
          const hasMoreRecents = data.length > limit;
          const current = this.#get();

          if (
            current.isRecentsInit &&
            current.hasMoreRecents === hasMoreRecents &&
            isEqual(current.recents, recents)
          ) {
            return;
          }

          this.#set(
            { hasMoreRecents, isRecentsInit: true, recents },
            false,
            n('useFetchRecents/onData'),
          );
        },
        refreshInterval: RECENTS_REFRESH_INTERVAL,
      },
    );
  };
}

export type RecentAction = Pick<RecentActionImpl, keyof RecentActionImpl>;
