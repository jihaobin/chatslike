'use client';

import { Button, Flexbox, Icon, Input, Skeleton, Tabs, Text } from '@lobehub/ui';
import type { TableProps } from 'antd';
import dayjs from 'dayjs';
import {
  BanIcon,
  CircleDollarSignIcon,
  GiftIcon,
  LockOpenIcon,
  MinusCircleIcon,
} from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import InlineTable from '@/components/InlineTable';
import { billingService } from '@/services/billing';
import { formatNumber } from '@/utils/format';

import CreditAmount from './components/CreditAmount';
import StatusTag from './components/StatusTag';
import {
  useAdminBillingAuditLogs,
  useAdminBillingLedger,
  useAdminBillingOrders,
  useAdminBillingUsers,
} from './hooks/useBillingData';
import { billingPageStyles as styles } from './styles';

const ADMIN_BILLING_TABS = ['users', 'orders', 'ledger', 'audit'] as const;

type AdminBillingTab = (typeof ADMIN_BILLING_TABS)[number];

const formatAmount = (amountCents?: number | null, currency?: string | null) => {
  if (typeof amountCents !== 'number') return '-';

  return `${currency ?? 'CNY'} ${(amountCents / 100).toLocaleString('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`;
};

const AdminActions = memo(() => {
  const { t } = useTranslation('subscription');
  const [amountCredits, setAmountCredits] = useState('');
  const [reason, setReason] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
  const [submittingAction, setSubmittingAction] = useState<string>();

  const runAction = async (
    action: 'deduct' | 'freeze' | 'grant' | 'unfreeze',
    runner: () => Promise<unknown>,
  ) => {
    setSubmittingAction(action);

    try {
      await runner();
    } finally {
      setSubmittingAction(undefined);
    }
  };

  const parsedAmountCredits = Number(amountCredits);
  const canSubmitAccountAction = targetUserId.trim().length > 0 && reason.trim().length > 0;
  const canSubmitCreditAction =
    canSubmitAccountAction && Number.isInteger(parsedAmountCredits) && parsedAmountCredits > 0;

  return (
    <Flexbox className={styles.card} gap={12} padding={16}>
      <Flexbox gap={4}>
        <Text className={styles.cardLabel}>
          {t('billingNative.admin.actions.title', 'Admin Actions')}
        </Text>
        <Text className={styles.subtitle}>
          {t(
            'billingNative.admin.actions.desc',
            'Use audited manual actions for support, finance, and risk reviews.',
          )}
        </Text>
      </Flexbox>
      <Flexbox horizontal gap={8} wrap={'wrap'}>
        <Input
          onChange={(event) => setTargetUserId(event.target.value)}
          placeholder={t('billingNative.admin.actions.targetUserId', 'Target user ID')}
          value={targetUserId}
        />
        <Input
          onChange={(event) => setAmountCredits(event.target.value)}
          placeholder={t('billingNative.admin.actions.amountCredits', 'Credits amount')}
          value={amountCredits}
        />
        <Input
          onChange={(event) => setReason(event.target.value)}
          placeholder={t('billingNative.admin.actions.reason', 'Reason')}
          value={reason}
        />
      </Flexbox>
      <Flexbox horizontal gap={8} wrap={'wrap'}>
        <Button
          disabled={!canSubmitCreditAction || submittingAction === 'grant'}
          icon={<Icon icon={GiftIcon} />}
          onClick={() =>
            void runAction('grant', () =>
              billingService.adminGrantCredits({
                amountCredits: parsedAmountCredits,
                reason,
                targetUserId,
              }),
            )
          }
          type={'primary'}
        >
          {t('billingNative.admin.actions.grantCredits', 'Grant Credits')}
        </Button>
        <Button
          disabled={!canSubmitCreditAction || submittingAction === 'deduct'}
          icon={<Icon icon={MinusCircleIcon} />}
          onClick={() =>
            void runAction('deduct', () =>
              billingService.adminDeductCredits({
                amountCredits: parsedAmountCredits,
                reason,
                targetUserId,
              }),
            )
          }
        >
          {t('billingNative.admin.actions.deductCredits', 'Deduct Credits')}
        </Button>
        <Button
          disabled={!canSubmitAccountAction || submittingAction === 'freeze'}
          icon={<Icon icon={BanIcon} />}
          onClick={() =>
            void runAction('freeze', () =>
              billingService.adminFreezeAccount({
                reason,
                targetUserId,
              }),
            )
          }
        >
          {t('billingNative.admin.actions.freezeAccount', 'Freeze Account')}
        </Button>
        <Button
          disabled={!canSubmitAccountAction || submittingAction === 'unfreeze'}
          icon={<Icon icon={LockOpenIcon} />}
          onClick={() =>
            void runAction('unfreeze', () =>
              billingService.adminUnfreezeAccount({
                reason,
                targetUserId,
              }),
            )
          }
        >
          {t('billingNative.admin.actions.unfreezeAccount', 'Unfreeze Account')}
        </Button>
      </Flexbox>
    </Flexbox>
  );
});

AdminActions.displayName = 'AdminActions';

const AdminBilling = memo(() => {
  const { t } = useTranslation('subscription');
  const [activeTab, setActiveTab] = useState<AdminBillingTab>('users');
  const usersData = useAdminBillingUsers();
  const ordersData = useAdminBillingOrders();
  const ledgerData = useAdminBillingLedger();
  const auditData = useAdminBillingAuditLogs();

  const usersColumns = useMemo<TableProps['columns']>(
    () => [
      {
        dataIndex: 'id',
        key: 'id',
        render: (value) => <Text code>{value}</Text>,
        title: t('billingNative.admin.users.userId', 'User ID'),
      },
      {
        dataIndex: 'email',
        key: 'email',
        render: (value) => value || '-',
        title: t('billingNative.admin.users.email', 'Email'),
      },
      {
        dataIndex: 'phone',
        key: 'phone',
        render: (value) => value || '-',
        title: t('billingNative.admin.users.phone', 'Phone'),
      },
      {
        dataIndex: 'accountStatus',
        key: 'accountStatus',
        render: (value) => <StatusTag status={value} type={'account'} />,
        title: t('billingNative.admin.users.accountStatus', 'Account Status'),
      },
      {
        dataIndex: 'availableCredits',
        key: 'availableCredits',
        render: (value) => <CreditAmount value={value} />,
        title: t('billingNative.admin.users.availableCredits', 'Available Credits'),
      },
      {
        dataIndex: 'frozenCredits',
        key: 'frozenCredits',
        render: (value) => <CreditAmount value={value} />,
        title: t('billingNative.admin.users.frozenCredits', 'Frozen Credits'),
      },
      {
        key: 'lifetimeCredits',
        render: (_, record) => (
          <Flexbox gap={2}>
            <Text>
              {t('billingNative.admin.users.lifetimeGranted', 'Granted')}:{' '}
              {formatNumber(record.lifetimeGrantedCredits)}
            </Text>
            <Text type={'secondary'}>
              {t('billingNative.admin.users.lifetimeConsumed', 'Consumed')}:{' '}
              {formatNumber(record.lifetimeConsumedCredits)}
            </Text>
          </Flexbox>
        ),
        title: t('billingNative.admin.users.lifetimeCredits', 'Lifetime Credits'),
      },
      {
        dataIndex: 'createdAt',
        key: 'createdAt',
        render: (value) => dayjs(value).format('YYYY-MM-DD HH:mm'),
        title: t('billingNative.admin.common.createdAt', 'Created'),
      },
    ],
    [t],
  );

  const ordersColumns = useMemo<TableProps['columns']>(
    () => [
      {
        dataIndex: 'id',
        key: 'id',
        render: (value) => <Text code>{value}</Text>,
        title: t('billingNative.admin.orders.orderId', 'Order ID'),
      },
      {
        dataIndex: 'userId',
        key: 'userId',
        render: (value) => <Text code>{value}</Text>,
        title: t('billingNative.admin.common.userId', 'User ID'),
      },
      {
        key: 'amount',
        render: (_, record) => (
          <Flexbox gap={2}>
            <Text>{formatAmount(record.amountCents, record.currency)}</Text>
            <Text type={'secondary'}>{formatNumber(record.credits)} Credits</Text>
          </Flexbox>
        ),
        title: t('billingNative.admin.orders.amount', 'Amount'),
      },
      {
        dataIndex: 'status',
        key: 'status',
        render: (value) => <StatusTag status={value} type={'order'} />,
        title: t('billingNative.admin.common.status', 'Status'),
      },
      {
        dataIndex: 'createdAt',
        key: 'createdAt',
        render: (value) => dayjs(value).format('YYYY-MM-DD HH:mm'),
        title: t('billingNative.admin.common.createdAt', 'Created'),
      },
    ],
    [t],
  );

  const ledgerColumns = useMemo<TableProps['columns']>(
    () => [
      {
        dataIndex: 'createdAt',
        key: 'createdAt',
        render: (value) => dayjs(value).format('YYYY-MM-DD HH:mm'),
        title: t('billingNative.admin.common.createdAt', 'Created'),
      },
      {
        dataIndex: 'userId',
        key: 'userId',
        render: (value) => <Text code>{value}</Text>,
        title: t('billingNative.admin.common.userId', 'User ID'),
      },
      {
        dataIndex: 'eventType',
        key: 'eventType',
        render: (value) => t(`billingNative.admin.ledger.eventType.${value}`, value),
        title: t('billingNative.admin.ledger.eventType', 'Event'),
      },
      {
        dataIndex: 'amountCredits',
        key: 'amountCredits',
        render: (value) => <CreditAmount value={value} />,
        title: t('billingNative.admin.ledger.amount', 'Amount'),
      },
      {
        dataIndex: 'balanceAfterCredits',
        key: 'balanceAfterCredits',
        render: (value) => <CreditAmount value={value} />,
        title: t('billingNative.admin.ledger.balanceAfter', 'Balance After'),
      },
      {
        dataIndex: 'reason',
        key: 'reason',
        render: (value) => value || '-',
        title: t('billingNative.admin.common.reason', 'Reason'),
      },
    ],
    [t],
  );

  const auditColumns = useMemo<TableProps['columns']>(
    () => [
      {
        dataIndex: 'createdAt',
        key: 'createdAt',
        render: (value) => dayjs(value).format('YYYY-MM-DD HH:mm'),
        title: t('billingNative.admin.common.createdAt', 'Created'),
      },
      {
        dataIndex: 'adminUserId',
        key: 'adminUserId',
        render: (value) => <Text code>{value}</Text>,
        title: t('billingNative.admin.audit.adminUserId', 'Admin User ID'),
      },
      {
        dataIndex: 'targetUserId',
        key: 'targetUserId',
        render: (value) => (value ? <Text code>{value}</Text> : '-'),
        title: t('billingNative.admin.audit.targetUserId', 'Target User ID'),
      },
      {
        dataIndex: 'action',
        key: 'action',
        render: (value) => t(`billingNative.admin.audit.action.${value}`, value),
        title: t('billingNative.admin.audit.action', 'Action'),
      },
      {
        dataIndex: 'amountCredits',
        key: 'amountCredits',
        render: (value) => (typeof value === 'number' ? <CreditAmount value={value} /> : '-'),
        title: t('billingNative.admin.ledger.amount', 'Amount'),
      },
      {
        dataIndex: 'reason',
        key: 'reason',
        render: (value) => value || '-',
        title: t('billingNative.admin.common.reason', 'Reason'),
      },
    ],
    [t],
  );

  const tableProps = {
    audit: {
      columns: auditColumns,
      dataSource: auditData.data?.items ?? [],
      loading: auditData.isLoading,
      locale: { emptyText: t('billingNative.admin.audit.empty', 'No audit logs yet') },
    },
    ledger: {
      columns: ledgerColumns,
      dataSource: ledgerData.data?.items ?? [],
      loading: ledgerData.isLoading,
      locale: { emptyText: t('billingNative.admin.ledger.empty', 'No ledger entries yet') },
    },
    orders: {
      columns: ordersColumns,
      dataSource: ordersData.data?.items ?? [],
      loading: ordersData.isLoading,
      locale: { emptyText: t('billingNative.admin.orders.empty', 'No orders yet') },
    },
    users: {
      columns: usersColumns,
      dataSource: usersData.data?.items ?? [],
      loading: usersData.isLoading,
      locale: { emptyText: t('billingNative.admin.users.empty', 'No users yet') },
    },
  } satisfies Record<AdminBillingTab, Pick<TableProps, 'columns' | 'dataSource' | 'loading' | 'locale'>>;

  const activeTableProps = tableProps[activeTab];

  if (
    usersData.isLoading &&
    ordersData.isLoading &&
    ledgerData.isLoading &&
    auditData.isLoading
  ) {
    return <Skeleton active paragraph={{ rows: 6 }} title={false} />;
  }

  return (
    <Flexbox className={styles.page} gap={16}>
      <Flexbox horizontal align={'center'} justify={'space-between'} wrap={'wrap'} gap={12}>
        <Flexbox gap={4}>
          <Flexbox horizontal align={'center'} gap={8}>
            <Icon icon={CircleDollarSignIcon} />
            <Text className={styles.header}>
              {t('billingNative.admin.title', 'Admin Billing')}
            </Text>
          </Flexbox>
          <Text className={styles.subtitle}>
            {t(
              'billingNative.admin.desc',
              'Review billing data and apply audited manual account actions.',
            )}
          </Text>
        </Flexbox>
      </Flexbox>

      <AdminActions />

      <Flexbox className={styles.section}>
        <Flexbox className={styles.sectionHeader} paddingBlock={8} paddingInline={16}>
          <Tabs
            activeKey={activeTab}
            items={ADMIN_BILLING_TABS.map((key) => ({
              key,
              label: t(`billingNative.admin.tabs.${key}`, key),
            }))}
            onChange={(key) => setActiveTab(key as AdminBillingTab)}
          />
        </Flexbox>
        <InlineTable
          columns={activeTableProps.columns}
          dataSource={activeTableProps.dataSource}
          loading={activeTableProps.loading}
          locale={activeTableProps.locale}
          rowKey={'id'}
        />
      </Flexbox>
    </Flexbox>
  );
});

AdminBilling.displayName = 'AdminBilling';
export default AdminBilling;
