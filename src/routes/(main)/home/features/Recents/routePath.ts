import { type RecentItem } from '@/server/routers/lambda/recent';

export const resolveHomeRecentRoutePath = (
  item: RecentItem,
  hideAgentManagement?: boolean,
): string => {
  if (
    hideAgentManagement &&
    item.type === 'topic' &&
    item.routePath.startsWith('/home/agent/')
  ) {
    return `/home?topic=${encodeURIComponent(item.id)}`;
  }

  return item.routePath;
};
