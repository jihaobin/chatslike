'use client';

import { Flexbox, Skeleton, Text } from '@lobehub/ui';
import type { TableProps } from 'antd';
import dayjs from 'dayjs';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import InlineTable from '@/components/InlineTable';
import { formatNumber } from '@/utils/format';

import StatusTag from './components/StatusTag';
import {
  BILLING_PAGE_SIZE,
  PAID_BILLING_ORDER_STATUSES,
  useBillingOrders,
} from './hooks/useBillingData';
import { billingPageStyles as styles } from './styles';
import { formatBillingAmount } from './utils';

const getCursorForPage = (cursors: Record<number, string | undefined>, page: number) =>
  page > 1 ? cursors[page] : undefined;

const Billing = memo(() => {
  const { t } = useTranslation('subscription');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(BILLING_PAGE_SIZE);
  const [cursors, setCursors] = useState<Record<number, string | undefined>>({});
  const { data, isLoading } = useBillingOrders({
    cursor: getCursorForPage(cursors, currentPage),
    pageSize,
    statuses: PAID_BILLING_ORDER_STATUSES,
  });

  const columns = useMemo<TableProps['columns']>(
    () => [
      {
        dataIndex: 'id',
        key: 'id',
        render: (value) => <Text code>{value}</Text>,
        title: t('billingNative.billing.orderNumber', 'Order Number'),
      },
      {
        dataIndex: 'orderType',
        key: 'orderType',
        render: (value) => t(`billingNative.orderType.${value}`, value),
        title: t('billingNative.billing.type', 'Type'),
      },
      {
        dataIndex: 'paymentChannel',
        key: 'paymentChannel',
        render: (value) => (value ? t(`billingNative.paymentChannel.${value}`, value) : '-'),
        title: t('billingNative.billing.paymentChannel', 'Payment Channel'),
      },
      {
        key: 'amount',
        render: (_, record) => (
          <Flexbox gap={2}>
            <Text>{formatBillingAmount(record.amountCents, record.currency)}</Text>
            <Text type={'secondary'}>
              {formatNumber(record.credits)} {t('billingNative.billing.creditsUnit', 'Credits')}
            </Text>
          </Flexbox>
        ),
        title: t('billingNative.billing.amount', 'Amount'),
      },
      {
        dataIndex: 'status',
        key: 'status',
        render: (value) => <StatusTag status={value} type={'order'} />,
        title: t('billingNative.billing.status', 'Status'),
      },
      {
        dataIndex: 'createdAt',
        key: 'createdAt',
        render: (value) => dayjs(value).format('YYYY-MM-DD HH:mm'),
        title: t('billingNative.billing.createdAt', 'Created'),
      },
    ],
    [t],
  );

  if (isLoading && !data) return <Skeleton active paragraph={{ rows: 6 }} title={false} />;

  const items = data?.items ?? [];
  const hasNextPage = Boolean(data?.nextCursor);

  return (
    <Flexbox className={styles.page} gap={16}>
      <Flexbox gap={4}>
        <Text className={styles.header}>{t('billingNative.billing.title', 'Orders')}</Text>
        <Text className={styles.subtitle}>
          {t('billingNative.billing.desc', 'Review Credits top-up and subscription orders.')}
        </Text>
      </Flexbox>

      <Flexbox className={styles.section}>
        <Flexbox className={styles.sectionHeader} paddingBlock={12} paddingInline={16}>
          <Text>{t('billingNative.billing.history', 'Order History')}</Text>
        </Flexbox>
        <InlineTable
          columns={columns}
          dataSource={items}
          loading={isLoading}
          locale={{ emptyText: t('billingNative.billing.empty', 'No orders yet') }}
          rowKey={'id'}
          pagination={{
            current: currentPage,
            onChange: (page, nextPageSize) => {
              if (nextPageSize !== pageSize) {
                setCurrentPage(1);
                setPageSize(nextPageSize);
                setCursors({});
                return;
              }

              if (page > currentPage && data?.nextCursor) {
                setCursors((prev) => ({ ...prev, [page]: data.nextCursor }));
              }

              setCurrentPage(page);
            },
            pageSize,
            showSizeChanger: true,
            total: hasNextPage
              ? currentPage * pageSize + 1
              : (currentPage - 1) * pageSize + items.length,
          }}
        />
      </Flexbox>
    </Flexbox>
  );
});

Billing.displayName = 'Billing';
export default Billing;
