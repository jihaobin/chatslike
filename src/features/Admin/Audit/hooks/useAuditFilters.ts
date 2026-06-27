'use client';

import { useSearchParams } from 'react-router-dom';

export interface AuditFilters {
  action?: string;
  dateFrom?: string;
  dateTo?: string;
  operatorEmail?: string;
  targetEmail?: string;
}

export const useAuditFilters = () => {
  const [params, setParams] = useSearchParams();

  const filters: AuditFilters = {
    action: params.get('action') ?? undefined,
    dateFrom: params.get('dateFrom') ?? undefined,
    dateTo: params.get('dateTo') ?? undefined,
    operatorEmail: params.get('operatorEmail') ?? undefined,
    targetEmail: params.get('targetEmail') ?? undefined,
  };

  const page = Number(params.get('page') ?? '1');
  const pageSize = Number(params.get('pageSize') ?? '20');

  const setFilters = (next: Partial<AuditFilters & { page?: number; pageSize?: number }>) => {
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      let resetPage = false;
      for (const key of ['action', 'dateFrom', 'dateTo', 'operatorEmail', 'targetEmail'] as const) {
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
