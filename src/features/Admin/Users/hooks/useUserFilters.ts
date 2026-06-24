'use client';

import { useSearchParams } from 'react-router-dom';

export interface UserFilters {
  banned?: boolean;
  createdAtFrom?: string;
  createdAtTo?: string;
  plan?: string;
  search?: string;
}

export const useUserFilters = () => {
  const [params, setParams] = useSearchParams();

  const filters: UserFilters = {
    banned:
      params.get('banned') === 'true' ? true : params.get('banned') === 'false' ? false : undefined,
    createdAtFrom: params.get('createdAtFrom') ?? undefined,
    createdAtTo: params.get('createdAtTo') ?? undefined,
    plan: params.get('plan') ?? undefined,
    search: params.get('search') ?? undefined,
  };

  const page = Number(params.get('page') ?? '1');
  const pageSize = Number(params.get('pageSize') ?? '20');

  const setFilters = (next: Partial<UserFilters & { page?: number }>) => {
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      if ('search' in next) {
        next.search ? p.set('search', next.search) : p.delete('search');
        p.set('page', '1');
      }
      if ('banned' in next) {
        next.banned === undefined ? p.delete('banned') : p.set('banned', String(next.banned));
        p.set('page', '1');
      }
      for (const key of ['plan', 'createdAtFrom', 'createdAtTo'] as const) {
        if (key in next) {
          next[key] ? p.set(key, next[key]!) : p.delete(key);
          p.set('page', '1');
        }
      }
      if ('page' in next) p.set('page', String(next.page));
      return p;
    });
  };

  return { filters, page, pageSize, setFilters };
};
