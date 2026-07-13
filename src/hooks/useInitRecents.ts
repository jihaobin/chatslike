import { useHomeStore } from '@/store/home';
import { useUserStore } from '@/store/user';
import { authSelectors } from '@/store/user/selectors';

export const useInitRecents = () => {
  const useFetchRecents = useHomeStore((s) => s.useFetchRecents);
  const recentListLimit = useHomeStore((s) => s.recentListLimit);
  const isLogin = useUserStore(authSelectors.isLogin);

  const { isValidating, data, ...rest } = useFetchRecents(isLogin, recentListLimit);

  return {
    ...rest,
    data,
    isLoading: rest.isLoading && isLogin,
    isRevalidating: isValidating && !!data,
  };
};
