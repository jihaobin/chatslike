'use client';

import { LineChart } from '@lobehub/charts';
import { Card, Col, Row, Segmented, Spin, Statistic } from 'antd';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { lambdaQuery } from '@/libs/trpc/client/lambda';
import { formatNumber } from '@/utils/format';

const CHART_HEIGHT = 240;

// 积分以百万(M)为单位显示,统一带 M 后缀避免 Y 轴量纲跳动
const formatCreditsM = (num: number) => `${formatNumber(num / 1_000_000, 2)}M`;
const formatRevenue = (num: number) => `¥${formatNumber(num, 2)}`;
const formatUsers = (num: number) => formatNumber(num);

const Dashboard = () => {
  const { t } = useTranslation('admin');
  const [granularity, setGranularity] = useState<'month' | 'week'>('month');

  const { data: stats, isLoading: statsLoading } = lambdaQuery.admin.dashboard.stats.useQuery();
  const { data: trends, isLoading: trendsLoading } = lambdaQuery.admin.dashboard.trends.useQuery({
    granularity,
  });

  const userData = useMemo(
    () => (trends?.userTrends ?? []).map((d) => ({ count: Number(d.count), period: d.period })),
    [trends],
  );
  const creditData = useMemo(
    () => (trends?.creditTrends ?? []).map((d) => ({ period: d.period, total: Number(d.total) })),
    [trends],
  );
  const revenueData = useMemo(
    () =>
      (trends?.revenueTrends ?? []).map((d) => ({
        period: d.period,
        total: Number(d.totalCents) / 100,
      })),
    [trends],
  );

  return (
    <div style={{ padding: 24 }}>
      <Spin spinning={statsLoading}>
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col span={5}>
            <Card>
              <Statistic title={t('dashboard.stats.totalUsers')} value={stats?.totalUsers ?? '-'} />
            </Card>
          </Col>
          <Col span={5}>
            <Card>
              <Statistic
                title={t('dashboard.stats.newUsers')}
                value={stats?.newUsersThisMonth ?? '-'}
              />
            </Card>
          </Col>
          <Col span={5}>
            <Card>
              <Statistic
                precision={2}
                prefix="¥"
                title={t('dashboard.stats.revenue')}
                value={stats ? stats.revenueThisMonthCents / 100 : '-'}
              />
            </Card>
          </Col>
          <Col span={5}>
            <Card>
              <Statistic
                title={t('dashboard.stats.credits')}
                value={stats?.creditsConsumedThisMonth ?? '-'}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title={t('dashboard.stats.abnormalOrders')}
                value={stats?.abnormalOrders ?? '-'}
                valueStyle={{ color: stats?.abnormalOrders ? '#cf1322' : undefined }}
              />
            </Card>
          </Col>
        </Row>
      </Spin>

      <div style={{ marginBottom: 16 }}>
        <Segmented
          options={['month', 'week']}
          value={granularity}
          onChange={(v) => setGranularity(v as 'month' | 'week')}
        />
      </div>

      <Spin spinning={trendsLoading}>
        <Row gutter={[16, 16]}>
          <Col span={8}>
            <Card title={t('dashboard.trend.userTrend')}>
              <LineChart
                categories={['count']}
                data={userData}
                height={CHART_HEIGHT}
                index="period"
                showLegend={false}
                valueFormatter={formatUsers}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card title={t('dashboard.trend.creditTrend')}>
              <LineChart
                categories={['total']}
                data={creditData}
                height={CHART_HEIGHT}
                index="period"
                showLegend={false}
                valueFormatter={formatCreditsM}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card title={t('dashboard.trend.revenueTrend')}>
              <LineChart
                categories={['total']}
                data={revenueData}
                height={CHART_HEIGHT}
                index="period"
                showLegend={false}
                valueFormatter={formatRevenue}
              />
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  );
};

export default Dashboard;
