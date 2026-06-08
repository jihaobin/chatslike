'use client';

import { ModelIcon } from '@lobehub/icons';
import { Flexbox, Skeleton, Tag, Text } from '@lobehub/ui';
import type { TableProps } from 'antd';
import { createStaticStyles } from 'antd-style';
import dayjs from 'dayjs';
import { ArrowDownIcon, ArrowUpIcon, FileTextIcon, ImageIcon, VideoIcon } from 'lucide-react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import InlineTable from '@/components/InlineTable';
import { formatNumber } from '@/utils/format';

import { useBillingUsageRecords } from './hooks/useBillingData';
import { formatUsageDuration, getUsageDurationMs, getUsageTotalTokens } from './usageUtils';

const styles = createStaticStyles(({ css, cssVar }) => ({
  card: css`
    overflow: hidden;

    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 8px;

    background: ${cssVar.colorBgContainer};
    box-shadow: 0 2px 8px ${cssVar.colorFillSecondary};
  `,
  creditCell: css`
    min-width: 92px;
    font-weight: 600;
    text-align: end;
  `,
  durationCell: css`
    min-width: 72px;
    text-align: end;
  `,
  modelCell: css`
    min-width: 164px;
    font-weight: 500;
  `,
  page: css`
    overflow: auto;
    width: 100%;
    height: 100%;
    padding-block: 38px;
  `,
  panel: css`
    width: min(1024px, calc(100% - 48px));
    margin-block: 0;
    margin-inline: auto;
  `,
  sectionHeader: css`
    height: 72px;
    padding-block: 14px 10px;
    padding-inline: 16px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};

    background: ${cssVar.colorFillQuaternary};
  `,
  subtitle: css`
    font-size: 12px;
    line-height: 1.5;
    color: ${cssVar.colorTextSecondary};
  `,
  table: css`
    .ant-table {
      line-height: 1.45;
    }

    .ant-table-thead > tr > th {
      height: 46px;
      padding-block: 12px !important;

      font-size: 13px;
      font-weight: 600;
      color: ${cssVar.colorText};
    }

    .ant-table-tbody > tr > td {
      height: 50px;
      padding-block: 10px !important;
      border-block-end: 1px solid ${cssVar.colorBorderSecondary} !important;

      font-size: 13px;
      color: ${cssVar.colorText};
    }

    .ant-table-tbody > tr:last-child > td {
      border-block-end: none !important;
    }
  `,
  title: css`
    margin: 0;
    padding-block-end: 28px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};

    font-size: 24px;
    font-weight: 700;
    line-height: 1.35;
    color: ${cssVar.colorText};
  `,
  tokenDetail: css`
    display: inline-flex;
    align-items: center;

    height: 20px;
    padding-inline: 5px;
    border-radius: 4px;

    font-size: 12px;
    color: ${cssVar.colorTextSecondary};
    white-space: nowrap;

    background: ${cssVar.colorFillQuaternary};
  `,
  tokenOperator: css`
    font-size: 12px;
    line-height: 20px;
    color: ${cssVar.colorTextQuaternary};
  `,
  tokenTotal: css`
    display: inline-flex;
    align-items: center;

    height: 20px;
    padding-inline: 6px;
    border-radius: 4px;

    font-size: 12px;
    color: ${cssVar.colorSuccessText};
    white-space: nowrap;

    background: ${cssVar.colorSuccessBg};
  `,
  triggerCell: css`
    min-width: 86px;
  `,
}));

const MODALITY_ICON = {
  image: ImageIcon,
  text: FileTextIcon,
  video: VideoIcon,
} as const;

const MODALITY_LABEL = {
  image: 'Image Generation',
  text: 'Text Generation',
  video: 'Video Generation',
} as const;

const getTriggerLabel = (metadata?: Record<string, unknown> | null) => {
  const trigger = metadata?.trigger ?? metadata?.source;

  return typeof trigger === 'string' && trigger ? trigger : undefined;
};

const Usage = memo(() => {
  const { t } = useTranslation('subscription');
  const { data, isLoading } = useBillingUsageRecords();

  const columns = useMemo<TableProps['columns']>(
    () => [
      {
        dataIndex: 'createdAt',
        key: 'createdAt',
        render: (value) => dayjs(value).format('YYYY-MM-DD HH:mm:ss'),
        title: t('billingNative.usage.createdAt', 'Created'),
        width: 170,
      },
      {
        dataIndex: 'modality',
        key: 'modality',
        render: (value) => {
          const Icon = MODALITY_ICON[value as keyof typeof MODALITY_ICON] ?? FileTextIcon;

          return (
            <Tag icon={<Icon size={12} />} size={'small'}>
              {t(
                `billingNative.usage.modality.${value}`,
                MODALITY_LABEL[value as keyof typeof MODALITY_LABEL] ?? value,
              )}
            </Tag>
          );
        },
        title: t('billingNative.usage.type', 'Type'),
        width: 132,
      },
      {
        key: 'trigger',
        render: (_, record) => (
          <span className={styles.triggerCell}>
            {getTriggerLabel(record.metadata) ??
              t('billingNative.usage.trigger.chat', 'Chat Message')}
          </span>
        ),
        title: t('billingNative.usage.trigger', 'Trigger'),
        width: 96,
      },
      {
        key: 'model',
        render: (_, record) => (
          <Flexbox horizontal align={'center'} className={styles.modelCell} gap={6}>
            <ModelIcon model={record.model} size={18} type={'mono'} />
            <Text as={'span'}>{record.model}</Text>
          </Flexbox>
        ),
        title: t('billingNative.usage.model', 'Model'),
        width: 190,
      },
      {
        key: 'tokens',
        render: (_, record) => {
          const inputTokens = record.inputTokens ?? 0;
          const outputTokens = record.outputTokens ?? 0;

          return (
            <Flexbox horizontal align={'center'} gap={6}>
              <span className={styles.tokenTotal}>
                {formatNumber(getUsageTotalTokens(inputTokens, outputTokens))}
              </span>
              <span className={styles.tokenOperator}>=</span>
              <span className={styles.tokenDetail}>
                <ArrowDownIcon size={12} />
                {formatNumber(inputTokens)}
              </span>
              <span className={styles.tokenOperator}>+</span>
              <span className={styles.tokenDetail}>
                <ArrowUpIcon size={12} />
                {formatNumber(outputTokens)}
              </span>
            </Flexbox>
          );
        },
        title: t('billingNative.usage.tokenUsage', 'Token Usage'),
        width: 210,
      },
      {
        dataIndex: 'actualCredits',
        key: 'actualCredits',
        render: (value) => <span className={styles.creditCell}>{formatNumber(value ?? 0)}</span>,
        title: t('billingNative.usage.credits', 'Credits'),
        width: 108,
      },
      {
        key: 'duration',
        render: (_, record) => (
          <span className={styles.durationCell}>
            {formatUsageDuration(getUsageDurationMs(record.metadata))}
          </span>
        ),
        title: t('billingNative.usage.duration', 'Duration'),
        width: 86,
      },
    ],
    [t],
  );

  if (isLoading && !data) {
    return (
      <Flexbox align={'center'} className={styles.page}>
        <Flexbox className={styles.panel} gap={36}>
          <Skeleton active paragraph={{ rows: 8 }} title={false} />
        </Flexbox>
      </Flexbox>
    );
  }

  const items = data?.items ?? [];

  return (
    <Flexbox align={'center'} className={styles.page}>
      <Flexbox className={styles.panel} gap={36}>
        <Text as={'h2'} className={styles.title}>
          {t('billingNative.usage.title', 'Usage')}
        </Text>

        <Flexbox className={styles.card}>
          <Flexbox className={styles.sectionHeader} gap={4}>
            <Text as={'span'}>
              {t('billingNative.usage.details', 'Compute Credits Usage Details')}
            </Text>
            <Text as={'span'} className={styles.subtitle}>
              {t(
                'billingNative.usage.desc',
                'Review compute Credits usage for text generation, embedding, image generation and other capabilities.',
              )}
            </Text>
          </Flexbox>
          <InlineTable
            className={styles.table}
            columns={columns}
            dataSource={items}
            loading={isLoading}
            locale={{ emptyText: t('billingNative.usage.empty', 'No Credits usage records yet') }}
            rowKey={'id'}
          />
        </Flexbox>
      </Flexbox>
    </Flexbox>
  );
});

Usage.displayName = 'Usage';
export default Usage;
