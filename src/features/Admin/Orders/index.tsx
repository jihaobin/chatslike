'use client';

import { Button, DatePicker, Input, Select, Space, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { lambdaQuery } from '@/libs/trpc/client/lambda';

import { useOrderFilters } from './hooks/useOrderFilters';

const STATUS_COLOR: Record<string, string> = {
  activated: 'green',
  closed: 'default',
  exception: 'red',
  failed: 'red',
  paid: 'blue',
  pending: 'orange',
  refunded: 'purple',
};

const ORDER_TYPE_KEYS = [
  'top_up',
  'subscription_new',
  'subscription_renew',
  'subscription_upgrade',
] as const;

const STATUS_KEYS = [
  'pending',
  'paid',
  'activated',
  'closed',
  'failed',
  'refunded',
  'exception',
] as const;

const AdminOrders = () => {
  const { t } = useTranslation('admin');
  const { filters, page, pageSize, setFilters } = useOrderFilters();
  const [exporting, setExporting] = useState(false);

  const { data, isLoading } = lambdaQuery.admin.orders.list.useQuery({
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    orderType: filters.orderType as any,
    page,
    pageSize,
    status: filters.status as any,
    userEmail: filters.userEmail,
  });

  const exportCsv = lambdaQuery.admin.orders.exportCsv.useQuery(
    {
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      orderType: filters.orderType as any,
      status: filters.status as any,
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
        status: filters.status,
        type: filters.orderType,
        user: filters.userEmail,
      })
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => `${k}-${v}`);
      a.download =
        parts.length > 0 ? `orders_${parts.join('_')}_${date}.csv` : `orders_${date}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const columns = [
    { dataIndex: 'id', ellipsis: true, title: 'ID', width: 160 },
    { dataIndex: 'userEmail', ellipsis: true, title: t('orders.column.userEmail'), width: 200 },
    {
      render: (_: unknown, r: { orderType: string }) =>
        t(`orders.orderType.${r.orderType}` as any, { defaultValue: r.orderType }),
      title: t('orders.column.orderType'),
      width: 120,
    },
    {
      render: (_: unknown, r: { status: string }) => (
        <Tag color={STATUS_COLOR[r.status] ?? 'default'}>
          {t(`orders.status.${r.status}` as any, { defaultValue: r.status })}
        </Tag>
      ),
      title: t('orders.column.status'),
      width: 100,
    },
    {
      render: (_: unknown, r: { amountCents: number; currency: string }) =>
        `${(r.amountCents / 100).toFixed(2)} ${r.currency}`,
      sorter: (a: { amountCents: number }, b: { amountCents: number }) =>
        a.amountCents - b.amountCents,
      title: t('orders.column.amount'),
      width: 100,
    },
    {
      dataIndex: 'credits',
      render: (v: number) => v.toLocaleString(),
      sorter: (a: { credits: number }, b: { credits: number }) => a.credits - b.credits,
      title: t('orders.column.credits'),
      width: 100,
    },
    { dataIndex: 'paymentChannel', title: t('orders.column.channel'), width: 100 },
    {
      dataIndex: 'createdAt',
      render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
      sorter: (a: { createdAt: string }, b: { createdAt: string }) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      title: t('orders.column.createdAt'),
      width: 160,
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space wrap style={{ marginBottom: 16, width: '100%' }}>
        <Input.Search
          defaultValue={filters.userEmail}
          placeholder={t('orders.search.placeholder')}
          style={{ width: 200 }}
          onSearch={(v) => setFilters({ userEmail: v })}
        />
        <Select
          allowClear
          options={STATUS_KEYS.map((s) => ({ label: t(`orders.status.${s}`), value: s }))}
          placeholder={t('orders.filter.status')}
          style={{ width: 120 }}
          value={filters.status}
          onChange={(v) => setFilters({ status: v })}
        />
        <Select
          allowClear
          options={ORDER_TYPE_KEYS.map((k) => ({ label: t(`orders.orderType.${k}`), value: k }))}
          placeholder={t('orders.filter.type')}
          style={{ width: 140 }}
          value={filters.orderType}
          onChange={(v) => setFilters({ orderType: v })}
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
        rowKey="id"
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

export default AdminOrders;
