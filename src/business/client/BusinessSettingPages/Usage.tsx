'use client';

import { Flexbox, Skeleton, Tag, Text } from '@lobehub/ui';
import type { TableProps } from 'antd';
import dayjs from 'dayjs';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import InlineTable from '@/components/InlineTable';

import CreditAmount from './components/CreditAmount';
import StatusTag from './components/StatusTag';
import { useBillingUsageRecords } from './hooks/useBillingData';
import { billingPageStyles as styles } from './styles';

const Usage = memo(() => {
  const { t } = useTranslation('subscription');
  const { data, isLoading } = useBillingUsageRecords();

  const columns = useMemo<TableProps['columns']>(
    () => [
      {
        dataIndex: 'createdAt',
        key: 'createdAt',
        render: (value) => dayjs(value).format('YYYY-MM-DD HH:mm'),
        title: t('billingNative.usage.time', 'Time'),
      },
      {
        dataIndex: 'modality',
        key: 'modality',
        render: (value) => <Tag size={'small'}>{t(`billingNative.modality.${value}`, value)}</Tag>,
        title: t('billingNative.usage.modality', 'Modality'),
      },
      {
        key: 'model',
        render: (_, record) => (
          <Flexbox gap={2}>
            <Text>{record.model}</Text>
            <Text type={'secondary'}>{record.provider}</Text>
          </Flexbox>
        ),
        title: t('billingNative.usage.providerModel', 'Provider / Model'),
      },
      {
        dataIndex: 'estimatedCredits',
        key: 'estimatedCredits',
        render: (value) => <CreditAmount value={value} />,
        title: t('billingNative.usage.estimated', 'Estimated'),
      },
      {
        dataIndex: 'actualCredits',
        key: 'actualCredits',
        render: (value) => <CreditAmount value={value} />,
        title: t('billingNative.usage.actual', 'Actual'),
      },
      {
        dataIndex: 'releasedCredits',
        key: 'releasedCredits',
        render: (value) => <CreditAmount value={value} />,
        title: t('billingNative.usage.released', 'Released'),
      },
      {
        dataIndex: 'status',
        key: 'status',
        render: (value) => <StatusTag status={value} type={'usage'} />,
        title: t('billingNative.usage.status', 'Status'),
      },
    ],
    [t],
  );

  if (isLoading && !data) return <Skeleton active paragraph={{ rows: 6 }} title={false} />;

  const items = data?.items ?? [];

  return (
    <Flexbox className={styles.page} gap={16}>
      <Flexbox gap={4}>
        <Text className={styles.header}>{t('billingNative.usage.title', 'Credits Usage')}</Text>
        <Text className={styles.subtitle}>
          {t('billingNative.usage.desc', 'Review model usage reservations and settlements.')}
        </Text>
      </Flexbox>

      <Flexbox className={styles.section}>
        <Flexbox className={styles.sectionHeader} paddingBlock={12} paddingInline={16}>
          <Text>{t('billingNative.usage.history', 'Usage Records')}</Text>
        </Flexbox>
        <InlineTable
          columns={columns}
          dataSource={items}
          loading={isLoading}
          locale={{ emptyText: t('billingNative.usage.empty', 'No Credits usage records yet') }}
          rowKey={'id'}
        />
      </Flexbox>
    </Flexbox>
  );
});

Usage.displayName = 'Usage';
export default Usage;
