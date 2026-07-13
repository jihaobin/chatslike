import { type RecentItem } from '@/server/routers/lambda/recent';

export const DEFAULT_RECENT_LIST_LIMIT = 20;
export const RECENT_LIST_LOAD_STEP = 20;

export interface RecentState {
  hasMoreRecents: boolean;
  isRecentsInit: boolean;
  recentListLimit: number;
  recents: RecentItem[];
}

export const initialRecentState: RecentState = {
  hasMoreRecents: false,
  isRecentsInit: false,
  recentListLimit: DEFAULT_RECENT_LIST_LIMIT,
  recents: [],
};
