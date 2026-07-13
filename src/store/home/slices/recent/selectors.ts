import { type HomeStore } from '@/store/home/store';

const hasMoreRecents = (s: HomeStore) => s.hasMoreRecents;
const recents = (s: HomeStore) => s.recents;
const recentListLimit = (s: HomeStore) => s.recentListLimit;
const isRecentsInit = (s: HomeStore) => s.isRecentsInit;

export const homeRecentSelectors = {
  hasMoreRecents,
  isRecentsInit,
  recentListLimit,
  recents,
};
