import { memo, Suspense } from 'react';

import SkeletonList from '@/features/NavPanel/components/SkeletonList';
import { useHomeStore } from '@/store/home';
import { homeRecentSelectors } from '@/store/home/selectors';
import { useUserStore } from '@/store/user';
import { authSelectors } from '@/store/user/slices/auth/selectors';

import RecentsList from './List';

interface RecentsProps {
  itemKey: string;
}

const Recents = memo<RecentsProps>(() => {
  const recents = useHomeStore(homeRecentSelectors.recents);
  const isInit = useHomeStore(homeRecentSelectors.isRecentsInit);
  const isLogin = useUserStore(authSelectors.isLogin);

  if (!isLogin) return null;
  if (isInit && (!recents || recents.length === 0)) return null;

  return (
    <Suspense fallback={<SkeletonList rows={3} />}>
      <RecentsList />
    </Suspense>
  );
});

export default Recents;
