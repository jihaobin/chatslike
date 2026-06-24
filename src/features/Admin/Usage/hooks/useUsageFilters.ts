'use client';

import { useSearchParams } from 'react-router-dom';

export interface UsageFilters {
  dateFrom?: string;
  dateTo?: string;
  modality?: string;
  model?: string;
  userEmail?: string;
}

export const useUsageFilters = () => {
  const [params, setParams] = useSearchParams();

  const filters: UsageFilters = {
    dateFrom: params.get('dateFrom') ?? undefined,
    dateTo: params.get('dateTo') ?? undefined,
    modality: params.get('modality') ?? undefined,
    model: params.get('model') ?? undefined,
    userEmail: params.get('userEmail') ?? undefined,
  };

  const page = Number(params.get('page') ?? '1');
  const pageSize = Number(params.get('pageSize') ?? '20');

  const setFilters = (next: Partial<UsageFilters & { page?: number }>) => {
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      let resetPage = false;
      for (const key of ['userEmail', 'model', 'modality', 'dateFrom', 'dateTo'] as const) {
        if (key in next) {
          next[key] ? p.set(key, next[key]!) : p.delete(key);
          resetPage = true;
        }
      }
      if ('page' in next) p.set('page', String(next.page));
      else if (resetPage) p.set('page', '1');
      return p;
    });
  };

  return { filters, page, pageSize, setFilters };
};
