'use client';

import { Button, DatePicker, Input, Select, Space, Table } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { lambdaQuery } from '@/libs/trpc/client/lambda';

import { useUsageFilters } from './hooks/useUsageFilters';

const MODALITY_KEYS = ['text', 'image', 'video'] as const;

const AdminUsage = () => {
  const { t } = useTranslation('admin');
  const { filters, page, pageSize, setFilters } = useUsageFilters();
  const [exporting, setExporting] = useState(false);

  const { data, isLoading } = lambdaQuery.admin.usage.list.useQuery({
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    modality: filters.modality as any,
    model: filters.model,
    page,
    pageSize,
    userEmail: filters.userEmail,
  });

  const exportCsv = lambdaQuery.admin.usage.exportCsv.useQuery(
    {
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      modality: filters.modality as any,
      model: filters.model,
      userEmail: filters.userEmail,
    },
    { enabled: false },
  );

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await exportCsv.refetch();
      const csv = result.data;
      if (!csv) return;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const date = new Date().toISOString().slice(0, 10);
      const parts = Object.entries({
        model: filters.model,
        modality: filters.modality,
        user: filters.userEmail,
      })
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => `${k}-${v}`);
      a.download = parts.length > 0 ? `usage_${parts.join('_')}_${date}.csv` : `usage_${date}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const columns = [
    { dataIndex: 'userId', ellipsis: true, title: t('usage.column.userId'), width: 160 },
    { dataIndex: 'userEmail', ellipsis: true, title: t('usage.column.userEmail') },
    { dataIndex: 'provider', ellipsis: true, title: t('usage.column.provider'), width: 120 },
    { dataIndex: 'model', ellipsis: true, title: t('usage.column.model') },
    {
      dataIndex: 'modality',
      render: (v: string) => t(`usage.modality.${v}` as any, { defaultValue: v }),
      title: t('usage.column.modality'),
      width: 80,
    },
    {
      dataIndex: 'requestCount',
      onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' } }),
      render: (v: number) => v.toLocaleString(),
      sorter: (a: { requestCount: number }, b: { requestCount: number }) =>
        a.requestCount - b.requestCount,
      title: t('usage.column.requestCount'),
      width: 90,
    },
    {
      dataIndex: 'totalInputTokens',
      onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' } }),
      render: (v: number) => v.toLocaleString(),
      sorter: (a: { totalInputTokens: number }, b: { totalInputTokens: number }) =>
        a.totalInputTokens - b.totalInputTokens,
      title: t('usage.column.inputTokens'),
      width: 100,
    },
    {
      dataIndex: 'totalOutputTokens',
      onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' } }),
      render: (v: number) => v.toLocaleString(),
      sorter: (a: { totalOutputTokens: number }, b: { totalOutputTokens: number }) =>
        a.totalOutputTokens - b.totalOutputTokens,
      title: t('usage.column.outputTokens'),
      width: 100,
    },
    {
      dataIndex: 'totalActualCredits',
      onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' } }),
      render: (v: number) => v.toLocaleString(),
      sorter: (a: { totalActualCredits: number }, b: { totalActualCredits: number }) =>
        a.totalActualCredits - b.totalActualCredits,
      title: t('usage.column.credits'),
      width: 100,
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space wrap style={{ marginBottom: 16, width: '100%' }}>
        <Input.Search
          defaultValue={filters.userEmail}
          placeholder={t('usage.search.userEmail')}
          style={{ width: 200 }}
          onSearch={(v) => setFilters({ userEmail: v })}
        />
        <Input.Search
          defaultValue={filters.model}
          placeholder={t('usage.search.model')}
          style={{ width: 180 }}
          onSearch={(v) => setFilters({ model: v })}
        />
        <Select
          allowClear
          placeholder={t('usage.filter.modality')}
          style={{ width: 100 }}
          value={filters.modality}
          options={MODALITY_KEYS.map((k) => ({
            label: t(`usage.modality.${k}` as any, { defaultValue: k }),
            value: k,
          }))}
          onChange={(v) => setFilters({ modality: v })}
        />
        <DatePicker.RangePicker
          placeholder={[t('common.datePicker.startDate'), t('common.datePicker.endDate')]}
          value={
            filters.dateFrom && filters.dateTo
              ? [dayjs(filters.dateFrom), dayjs(filters.dateTo)]
              : undefined
          }
          onChange={(dates) =>
            setFilters({
              dateFrom: dates?.[0]?.startOf('day').toISOString(),
              dateTo: dates?.[1]?.endOf('day').toISOString(),
            })
          }
        />
        <Button loading={exporting} onClick={handleExport}>
          {t('common.action.exportCsv')}
        </Button>
      </Space>

      <Table
        columns={columns}
        dataSource={data?.items ?? []}
        loading={isLoading}
        rowKey={(r) => `${r.userId}-${r.model}-${r.provider}-${r.modality}`}
        size="small"
        pagination={{
          current: page,
          onChange: (p, ps) => setFilters({ page: p, pageSize: ps }),
          pageSize,
          showSizeChanger: true,
          showTotal: (total) => t('common.table.total', { total }),
          total: data?.total ?? 0,
        }}
      />
    </div>
  );
};

export default AdminUsage;
