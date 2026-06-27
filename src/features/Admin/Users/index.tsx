'use client';

import { Button, Input, message, Select, Space, Table, Tag } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { lambdaQuery } from '@/libs/trpc/client/lambda';

import BanModal from './components/BanModal';
import BatchGrantModal from './components/BatchGrantModal';
import GrantCreditModal from './components/GrantCreditModal';
import { useUserFilters } from './hooks/useUserFilters';

const AdminUsers = () => {
  const { t } = useTranslation('admin');
  const { t: tSub } = useTranslation('subscription');
  const { filters, page, pageSize, setFilters } = useUserFilters();
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [grantTarget, setGrantTarget] = useState<string | null>(null);
  const [banTarget, setBanTarget] = useState<string | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const { data, isLoading, refetch } = lambdaQuery.admin.users.list.useQuery({
    banned: filters.banned,
    createdAtFrom: filters.createdAtFrom,
    createdAtTo: filters.createdAtTo,
    page,
    pageSize,
    plan: filters.plan,
    search: filters.search,
  });

  const { mutateAsync: unbanUser } = lambdaQuery.admin.users.unbanUser.useMutation();
  const exportCsv = lambdaQuery.admin.users.exportCsv.useQuery(
    {
      banned: filters.banned,
      createdAtFrom: filters.createdAtFrom,
      createdAtTo: filters.createdAtTo,
      plan: filters.plan,
      search: filters.search,
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
        banned: filters.banned,
        plan: filters.plan,
        search: filters.search,
      })
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => `${k}-${v}`);
      a.download = parts.length > 0 ? `users_${parts.join('_')}_${date}.csv` : `users_${date}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const handleUnban = async (userId: string) => {
    await unbanUser({ userId });
    message.success(t('users.message.unbanned'));
    refetch();
  };

  const columns = [
    { dataIndex: 'id', ellipsis: true, title: 'ID', width: 120 },
    {
      render: (_: unknown, r: { fullName: string | null; username: string | null }) =>
        r.fullName || r.username || '-',
      title: t('users.column.username'),
    },
    { dataIndex: 'email', title: t('users.column.email') },
    {
      dataIndex: 'currentPlan',
      render: (v: string | null) =>
        v
          ? tSub(`billingNative.plans.planName.${v}` as any, { defaultValue: v })
          : tSub('billingNative.plans.free.name'),
      sorter: (a: { currentPlan: string | null }, b: { currentPlan: string | null }) =>
        (a.currentPlan ?? '').localeCompare(b.currentPlan ?? ''),
      title: t('users.column.plan'),
    },
    {
      render: (_: unknown, r: { subscriptionCredits: number; topUpCredits: number }) => (
        <span>
          {(r.subscriptionCredits ?? 0).toLocaleString()} / {(r.topUpCredits ?? 0).toLocaleString()}
        </span>
      ),
      sorter: (a: { subscriptionCredits: number }, b: { subscriptionCredits: number }) =>
        (a.subscriptionCredits ?? 0) - (b.subscriptionCredits ?? 0),
      title: t('users.column.credits'),
    },
    {
      render: (_: unknown, r: { banned: boolean | null }) =>
        r.banned ? (
          <Tag color="red">{t('users.status.banned')}</Tag>
        ) : (
          <Tag color="green">{t('users.status.normal')}</Tag>
        ),
      title: t('users.column.status'),
    },
    {
      render: (_: unknown, r: { banned: boolean | null; id: string }) => (
        <Space size="small">
          <Button size="small" type="link" onClick={() => setGrantTarget(r.id)}>
            {t('users.action.grantCredits')}
          </Button>
          {r.banned ? (
            <Button size="small" type="link" onClick={() => handleUnban(r.id)}>
              {t('users.action.unban')}
            </Button>
          ) : (
            <Button danger size="small" type="link" onClick={() => setBanTarget(r.id)}>
              {t('users.action.ban')}
            </Button>
          )}
        </Space>
      ),
      title: t('users.column.actions'),
      width: 160,
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space wrap style={{ marginBottom: 16, width: '100%' }}>
        <Input.Search
          defaultValue={filters.search}
          placeholder={t('users.search.placeholder')}
          style={{ width: 240 }}
          onSearch={(v) => setFilters({ search: v })}
        />
        <Select
          allowClear
          placeholder={t('users.filter.bannedStatus')}
          style={{ width: 120 }}
          value={filters.banned}
          options={[
            { label: t('users.filter.normal'), value: false },
            { label: t('users.filter.banned'), value: true },
          ]}
          onChange={(v) => setFilters({ banned: v })}
        />
        <Button
          disabled={selectedRowKeys.length === 0}
          type="primary"
          onClick={() => setBatchOpen(true)}
        >
          {t('users.action.batchGrant', { count: selectedRowKeys.length })}
        </Button>
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
        rowSelection={{
          onChange: (keys) => setSelectedRowKeys(keys as string[]),
          selectedRowKeys,
        }}
      />

      {grantTarget && (
        <GrantCreditModal
          open
          userId={grantTarget}
          onCancel={() => setGrantTarget(null)}
          onSuccess={() => {
            setGrantTarget(null);
            refetch();
          }}
        />
      )}
      {banTarget && (
        <BanModal
          open
          userId={banTarget}
          onCancel={() => setBanTarget(null)}
          onSuccess={() => {
            setBanTarget(null);
            refetch();
          }}
        />
      )}
      {batchOpen && (
        <BatchGrantModal
          open
          userIds={selectedRowKeys}
          onCancel={() => setBatchOpen(false)}
          onSuccess={() => {
            setBatchOpen(false);
            setSelectedRowKeys([]);
            refetch();
          }}
        />
      )}
    </div>
  );
};

export default AdminUsers;
