'use client';

import { useSearchParams } from 'react-router-dom';

export interface OrderFilters {
  dateFrom?: string;
  dateTo?: string;
  orderType?: string;
  status?: string;
  userEmail?: string;
}

export const useOrderFilters = () => {
  const [params, setParams] = useSearchParams();

  const filters: OrderFilters = {
    dateFrom: params.get('dateFrom') ?? undefined,
    dateTo: params.get('dateTo') ?? undefined,
    orderType: params.get('orderType') ?? undefined,
    status: params.get('status') ?? undefined,
    userEmail: params.get('userEmail') ?? undefined,
  };

  const page = Number(params.get('page') ?? '1');
  const pageSize = Number(params.get('pageSize') ?? '20');

  const setFilters = (next: Partial<OrderFilters & { page?: number; pageSize?: number }>) => {
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      let resetPage = false;
      for (const key of ['userEmail', 'status', 'orderType', 'dateFrom', 'dateTo'] as const) {
        if (key in next) {
          next[key] ? p.set(key, next[key]!) : p.delete(key);
          resetPage = true;
        }
      }
      if ('pageSize' in next) p.set('pageSize', String(next.pageSize));
      if ('page' in next) p.set('page', String(next.page));
      else if (resetPage) p.set('page', '1');
      return p;
    });
  };

  return { filters, page, pageSize, setFilters };
};
