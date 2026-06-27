'use client';

import { DatePicker, Input, Select, Space, Table, Tag, Tooltip } from 'antd';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';

import { lambdaQuery } from '@/libs/trpc/client/lambda';

import { useAuditFilters } from './hooks/useAuditFilters';

const ACTION_COLOR: Record<string, string> = {
  account_ban: '#b91c1c',
  account_unban: '#15803d',
  batch_credit_grant: '#1d4ed8',
  credit_grant: '#1d4ed8',
  credit_revoke: '#c2410c',
};

const ACTION_KEYS = [
  'credit_grant',
  'credit_revoke',
  'batch_credit_grant',
  'account_ban',
  'account_unban',
] as const;

const AdminAudit = () => {
  const { t } = useTranslation('admin');
  const { filters, page, pageSize, setFilters } = useAuditFilters();

  const { data, isLoading } = lambdaQuery.admin.audit.list.useQuery({
    action: filters.action as any,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    operatorEmail: filters.operatorEmail,
    page,
    pageSize,
    targetEmail: filters.targetEmail,
  });

  const buildSummary = (action: string, afterValue: unknown) => {
    const after = afterValue as Record<string, any> | null;
    switch (action) {
      case 'credit_grant':
      case 'batch_credit_grant': {
        const expires = after?.expiresAt
          ? t(
              action === 'credit_grant'
                ? 'audit.detail.creditGrantExpires'
                : 'audit.detail.creditGrantExpires',
              {
                date: new Date(after.expiresAt).toLocaleDateString(),
              },
            )
          : '';
        const key =
          action === 'credit_grant' ? 'audit.detail.creditGrant' : 'audit.detail.batchCreditGrant';
        return t(key, { amount: Number(after?.amount ?? 0).toLocaleString(), expires });
      }
      case 'credit_revoke': {
        return t('audit.detail.creditRevoke', {
          amount: Number(after?.revokedAmount ?? 0).toLocaleString(),
        });
      }
      case 'account_ban': {
        const reason = after?.banReason
          ? t('audit.detail.banReason', { reason: after.banReason })
          : '';
        const expires = after?.banExpires
          ? t('audit.detail.banExpires', { date: new Date(after.banExpires).toLocaleDateString() })
          : t('audit.detail.banPermanent');
        return t('audit.detail.banAccount', { expires, reason });
      }
      case 'account_unban': {
        return t('audit.detail.accountUnban');
      }
      default: {
        return JSON.stringify(after ?? {});
      }
    }
  };

  const columns = [
    {
      dataIndex: 'createdAt',
      render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
      sorter: (a: { createdAt: string }, b: { createdAt: string }) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      title: t('audit.column.createdAt'),
      width: 160,
    },
    { dataIndex: 'operatorEmail', ellipsis: true, title: t('audit.column.operator') },
    { dataIndex: 'targetEmail', ellipsis: true, title: t('audit.column.target') },
    {
      render: (_: unknown, r: { action: string }) => (
        <Tag color={ACTION_COLOR[r.action] ?? 'default'}>
          {t(`audit.action.${r.action}` as any, { defaultValue: r.action })}
        </Tag>
      ),
      title: t('audit.column.actionType'),
      width: 130,
    },
    {
      render: (_: unknown, r: { action: string; afterValue: unknown; beforeValue: unknown }) => {
        const summary = buildSummary(r.action, r.afterValue);
        const full = JSON.stringify({ after: r.afterValue, before: r.beforeValue }, null, 2);
        return (
          <Tooltip
            overlayInnerStyle={{ maxWidth: 480 }}
            title={<pre style={{ fontSize: 12, margin: 0 }}>{full}</pre>}
          >
            <span style={{ cursor: 'default' }}>{summary}</span>
          </Tooltip>
        );
      },
      title: t('audit.column.detail'),
    },
    { dataIndex: 'note', ellipsis: true, title: t('audit.column.note') },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space wrap style={{ marginBottom: 16, width: '100%' }}>
        <Input.Search
          defaultValue={filters.operatorEmail}
          placeholder={t('audit.search.operatorEmail')}
          style={{ width: 200 }}
          onSearch={(v) => setFilters({ operatorEmail: v })}
        />
        <Input.Search
          defaultValue={filters.targetEmail}
          placeholder={t('audit.search.targetEmail')}
          style={{ width: 200 }}
          onSearch={(v) => setFilters({ targetEmail: v })}
        />
        <Select
          allowClear
          placeholder={t('audit.filter.actionType')}
          style={{ width: 150 }}
          value={filters.action}
          options={ACTION_KEYS.map((k) => ({
            label: t(`audit.action.${k}` as any),
            value: k,
          }))}
          onChange={(v) => setFilters({ action: v })}
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

export default AdminAudit;
