'use client';

import { Button, Flexbox, Icon, Input, Tabs, Text } from '@lobehub/ui';
import type { TableProps } from 'antd';
import { DatePicker, Drawer, Form, InputNumber, Modal, Select, Switch, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  DatabaseIcon,
  DollarSignIcon,
  ExternalLinkIcon,
  FilterIcon,
  RefreshCwIcon,
  SearchIcon,
} from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { PlatformCatalogFilters } from '@/services/billing';
import { billingService } from '@/services/billing';

import {
  refreshPlatformCatalog,
  usePlatformCatalogModels,
  usePlatformCatalogStatus,
  usePlatformModelPricing,
} from './hooks/useBillingData';
import { billingPageStyles as styles } from './styles';

interface PlatformModelRecord {
  abilities?: Record<string, unknown> | null;
  contextWindowTokens?: number | null;
  currentPricing?: PricingRecord;
  displayName?: string | null;
  enabled?: boolean | null;
  hasPricingGap?: boolean;
  id: string;
  nextPricing?: PricingRecord;
  providerId: string;
  type?: string | null;
  updatedAt?: Date | string | null;
  upstreamDisplayName?: string;
  upstreamProvider?: string;
}

interface PricingRecord {
  effectiveAt?: Date | string;
  fixedCreditsPerUnit?: number | null;
  id?: string;
  inputCreditsPerMillionTokens?: number | null;
  modality: 'text' | 'image' | 'video';
  outputCreditsPerMillionTokens?: number | null;
  priceKey: string;
  provider?: string;
  status?: string;
  unit?: string | null;
}

type PricingModality = PricingRecord['modality'];

const ALL_UPSTREAM = 'all';
const GAP_FILTER = 'pricing-gap';

const formatDate = (value?: Date | string | null) =>
  value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-';

const getDisplayName = (model: PlatformModelRecord) => model.displayName || model.id;

const getDefaultPricingModality = (model: PlatformModelRecord): PricingModality => {
  if (model.currentPricing?.modality) return model.currentPricing.modality;
  if (model.type === 'image' || model.type === 'video') return model.type;

  return 'text';
};

const getPriceSummary = (price?: PricingRecord) => {
  if (!price) return '-';
  if (price.modality === 'text') {
    return `${price.inputCreditsPerMillionTokens ?? '-'} / ${price.outputCreditsPerMillionTokens ?? '-'}`;
  }

  return `${price.fixedCreditsPerUnit ?? '-'} credits / ${price.unit ?? 'unit'}`;
};

const PlatformCatalog = memo(() => {
  const { t } = useTranslation('subscription');
  const [activeUpstream, setActiveUpstream] = useState(ALL_UPSTREAM);
  const [onlyPricingGap, setOnlyPricingGap] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [selectedModel, setSelectedModel] = useState<PlatformModelRecord>();
  const [activeDrawerTab, setActiveDrawerTab] = useState('model');
  const [inputPrice, setInputPrice] = useState<number>();
  const [outputPrice, setOutputPrice] = useState<number>();
  const [fixedPrice, setFixedPrice] = useState<number>();
  const [effectiveAt, setEffectiveAt] = useState<Date>();
  const [pricingModality, setPricingModality] = useState<PricingModality>('text');

  const filters: PlatformCatalogFilters = {};
  const status = usePlatformCatalogStatus();
  const models = usePlatformCatalogModels(filters);
  const pricing = usePlatformModelPricing(
    selectedModel ? { model: selectedModel.id, modality: 'text' } : undefined,
  );

  const modelList = (models.data ?? []) as PlatformModelRecord[];
  const pricingList = (pricing.data ?? []) as PricingRecord[];

  const upstreamGroups = useMemo(() => {
    const map = new Map<string, { enabled: number; gaps: number; label: string; total: number }>();
    for (const model of modelList) {
      const key = model.upstreamProvider || 'other';
      const current = map.get(key) ?? {
        enabled: 0,
        gaps: 0,
        label: model.upstreamDisplayName || key,
        total: 0,
      };
      current.total += 1;
      if (model.enabled !== false) current.enabled += 1;
      if (model.hasPricingGap) current.gaps += 1;
      map.set(key, current);
    }

    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [modelList]);

  const filteredModels = useMemo(() => {
    const search = searchValue.trim().toLowerCase();

    return modelList.filter((model) => {
      if (activeUpstream !== ALL_UPSTREAM && model.upstreamProvider !== activeUpstream)
        return false;
      if (onlyPricingGap && !model.hasPricingGap) return false;
      if (!search) return true;

      return `${model.id} ${model.displayName ?? ''} ${model.upstreamDisplayName ?? ''}`
        .toLowerCase()
        .includes(search);
    });
  }, [activeUpstream, modelList, onlyPricingGap, searchValue]);

  const openModel = (model: PlatformModelRecord) => {
    const currentPrice = model.currentPricing;
    setSelectedModel(model);
    setActiveDrawerTab('model');
    setInputPrice(currentPrice?.inputCreditsPerMillionTokens ?? undefined);
    setOutputPrice(currentPrice?.outputCreditsPerMillionTokens ?? undefined);
    setFixedPrice(currentPrice?.fixedCreditsPerUnit ?? undefined);
    setEffectiveAt(undefined);
    setPricingModality(getDefaultPricingModality(model));
  };

  const handleToggleModel = async (model: PlatformModelRecord, enabled: boolean) => {
    const run = async () => {
      await billingService.adminTogglePlatformModelEnabled({
        enabled,
        model: model.id,
        reason: 'admin_toggle_model',
      });
      await refreshPlatformCatalog(filters);
    };

    if (!enabled) {
      Modal.confirm({
        content: t(
          'billingNative.admin.platformCatalog.disableModelConfirm',
          '禁用后用户将无法继续选择该模型。',
        ),
        onOk: () => void run(),
        title: t('billingNative.admin.platformCatalog.disableModelTitle', '确认禁用模型'),
      });
      return;
    }

    await run();
  };

  const handleCreatePricing = async () => {
    if (!selectedModel) return;

    await billingService.adminCreateModelPricingVersion({
      effectiveAt,
      fixedCreditsPerUnit: fixedPrice,
      inputCreditsPerMillionTokens: inputPrice,
      modality: pricingModality,
      model: selectedModel.id,
      outputCreditsPerMillionTokens: outputPrice,
      priceKey: `${selectedModel.id}:${Date.now()}`,
      reason: 'admin_create_price_version',
      unit: selectedModel.currentPricing?.unit ?? undefined,
    });
    await refreshPlatformCatalog(filters);
  };

  const columns = useMemo<TableProps<PlatformModelRecord>['columns']>(
    () => [
      {
        dataIndex: 'displayName',
        key: 'model',
        render: (_, record) => (
          <Flexbox gap={2}>
            <Text>{getDisplayName(record)}</Text>
            <Text code>{record.id}</Text>
          </Flexbox>
        ),
        title: t('billingNative.admin.platformCatalog.table.model', '模型'),
      },
      {
        dataIndex: 'upstreamDisplayName',
        key: 'upstream',
        render: (_, record) => (
          <Flexbox gap={2}>
            <Text>{record.upstreamDisplayName || record.upstreamProvider || 'Other'}</Text>
            <Text code>{record.providerId}</Text>
          </Flexbox>
        ),
        title: t('billingNative.admin.platformCatalog.table.upstream', '上游来源'),
      },
      {
        dataIndex: 'type',
        key: 'type',
        render: (value) => <Tag>{String(value ?? 'chat')}</Tag>,
        title: t('billingNative.admin.platformCatalog.table.type', '类型'),
      },
      {
        dataIndex: 'enabled',
        key: 'enabled',
        render: (value, record) => (
          <Switch
            checked={value !== false}
            onChange={(checked) => void handleToggleModel(record, checked)}
          />
        ),
        title: t('billingNative.admin.common.status', '状态'),
      },
      {
        dataIndex: 'contextWindowTokens',
        key: 'context',
        render: (value) => (typeof value === 'number' ? value.toLocaleString() : '-'),
        title: t('billingNative.admin.platformCatalog.table.context', '上下文'),
      },
      {
        dataIndex: 'currentPricing',
        key: 'pricing',
        render: (_, record) =>
          record.hasPricingGap ? (
            <Tag>{t('billingNative.admin.platformCatalog.pricingGap', '价格缺口')}</Tag>
          ) : (
            getPriceSummary(record.currentPricing)
          ),
        title: t('billingNative.admin.platformCatalog.table.currentPricing', '当前价格'),
      },
      {
        dataIndex: 'nextPricing',
        key: 'nextPricing',
        render: (_, record) => formatDate(record.nextPricing?.effectiveAt),
        title: t('billingNative.admin.platformCatalog.table.nextPricing', '预约价格'),
      },
      {
        dataIndex: 'updatedAt',
        key: 'updatedAt',
        render: (value) => formatDate(value as Date | string | null),
        title: t('billingNative.admin.platformCatalog.table.updatedAt', '更新时间'),
      },
    ],
    [t],
  );

  const credentialOk = Boolean(status.data?.credentialStatus?.configured);

  return (
    <Flexbox className={styles.platformCatalog} gap={12}>
      <Flexbox horizontal className={styles.platformStatusBar} gap={12} wrap={'wrap'}>
        <Flexbox className={styles.platformMetric} gap={4}>
          <Flexbox horizontal align={'center'} gap={8}>
            <Icon icon={DatabaseIcon} />
            <Text>{t('billingNative.admin.platformCatalog.title', 'New API 模型目录')}</Text>
          </Flexbox>
          <Text>{status.data?.enabled ? 'Enabled' : 'Disabled'}</Text>
        </Flexbox>
        <Flexbox className={styles.platformMetric} gap={4}>
          <Flexbox horizontal align={'center'} gap={8}>
            <Icon icon={credentialOk ? CheckCircleIcon : AlertTriangleIcon} />
            <Text>
              {credentialOk
                ? t('billingNative.admin.platformCatalog.credentialOk', '凭据正常')
                : t('billingNative.admin.platformCatalog.missingCredential', '缺少凭据')}
            </Text>
          </Flexbox>
          <Text code>
            {status.data?.credentialStatus?.missingKeys?.join(', ') || 'NEWAPI_API_KEY'}
          </Text>
        </Flexbox>
        <Flexbox className={styles.platformMetric}>
          <Text>{t('billingNative.admin.platformCatalog.totalModels', '模型总数')}</Text>
          <Text>{status.data?.modelCount ?? 0}</Text>
        </Flexbox>
        <Flexbox className={styles.platformMetric}>
          <Text>{t('billingNative.admin.platformCatalog.enabledModels', '已启用')}</Text>
          <Text>{status.data?.enabledModelCount ?? 0}</Text>
        </Flexbox>
        <Flexbox className={styles.platformMetric}>
          <Text>{t('billingNative.admin.platformCatalog.pricingGaps', '价格缺口')}</Text>
          <Text>{status.data?.pricingGapCount ?? 0}</Text>
        </Flexbox>
        <Flexbox className={styles.platformMetric}>
          <Text>{t('billingNative.admin.platformCatalog.futurePricing', '预约价格')}</Text>
          <Text>{status.data?.futurePricingCount ?? 0}</Text>
        </Flexbox>
        <Button disabled icon={<Icon icon={RefreshCwIcon} />}>
          {t('billingNative.admin.platformCatalog.syncComingSoon', '同步模型/价格')}
        </Button>
      </Flexbox>

      <Flexbox horizontal className={styles.platformWorkbench} gap={12}>
        <Flexbox className={styles.platformSidebar} gap={8}>
          <Input
            placeholder={t('billingNative.admin.platformCatalog.search', '搜索模型')}
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
          />
          <Button
            icon={<Icon icon={FilterIcon} />}
            type={onlyPricingGap ? 'primary' : undefined}
            onClick={() => setOnlyPricingGap((value) => !value)}
          >
            {t('billingNative.admin.platformCatalog.onlyPricingGap', '只看价格缺口')}
          </Button>
          <Button
            icon={<Icon icon={SearchIcon} />}
            type={activeUpstream === ALL_UPSTREAM ? 'primary' : undefined}
            onClick={() => setActiveUpstream(ALL_UPSTREAM)}
          >
            {t('billingNative.admin.platformCatalog.allUpstream', '全部来源')} ({modelList.length})
          </Button>
          {upstreamGroups.map(([key, group]) => (
            <Button
              key={key}
              type={activeUpstream === key ? 'primary' : undefined}
              onClick={() => setActiveUpstream(key)}
            >
              {group.label} ({group.enabled}/{group.total}) · {group.gaps}
            </Button>
          ))}
        </Flexbox>

        <Flexbox className={styles.platformTable} flex={1}>
          <Table
            columns={columns}
            dataSource={filteredModels}
            loading={models.isLoading}
            pagination={false}
            rowKey={'id'}
            onRow={(record) => ({ onClick: () => openModel(record) })}
          />
        </Flexbox>
      </Flexbox>

      <Drawer
        destroyOnHidden
        open={Boolean(selectedModel)}
        title={selectedModel ? getDisplayName(selectedModel) : ''}
        width={520}
        onClose={() => setSelectedModel(undefined)}
      >
        {selectedModel ? (
          <Flexbox gap={12}>
            <Tabs
              activeKey={activeDrawerTab}
              items={[
                {
                  key: 'model',
                  label: t('billingNative.admin.platformCatalog.drawer.model', 'Model'),
                },
                {
                  key: 'pricing',
                  label: t('billingNative.admin.platformCatalog.drawer.pricing', 'Pricing'),
                },
              ]}
              onChange={setActiveDrawerTab}
            />
            {activeDrawerTab === 'model' ? (
              <Flexbox gap={10}>
                <Text>{t('billingNative.admin.platformCatalog.model.provider', 'Provider')}</Text>
                <Text code>{selectedModel.providerId}</Text>
                <Text>{t('billingNative.admin.platformCatalog.model.upstream', '上游来源')}</Text>
                <Text>
                  {selectedModel.upstreamDisplayName || selectedModel.upstreamProvider || 'Other'}
                </Text>
                <Text>
                  {t('billingNative.admin.platformCatalog.model.context', 'Context window')}
                </Text>
                <Text>{selectedModel.contextWindowTokens?.toLocaleString() ?? '-'}</Text>
                <Button
                  icon={<Icon icon={ExternalLinkIcon} />}
                  onClick={() =>
                    void billingService.adminUpdatePlatformModel({
                      model: selectedModel.id,
                      reason: 'admin_update_model',
                      upstreamDisplayName: selectedModel.upstreamDisplayName,
                      upstreamProvider: selectedModel.upstreamProvider,
                    })
                  }
                >
                  {t('billingNative.admin.platformCatalog.model.save', '保存模型信息')}
                </Button>
              </Flexbox>
            ) : (
              <Flexbox gap={12}>
                <Flexbox gap={4}>
                  <Text>
                    {t(
                      'billingNative.admin.platformCatalog.pricing.providerFixed',
                      'provider 固定为 newapi',
                    )}
                  </Text>
                  <Text>
                    {t(
                      'billingNative.admin.platformCatalog.pricing.upstreamHint',
                      '上游来源仅作为模型标签展示。',
                    )}
                  </Text>
                </Flexbox>
                <Flexbox gap={6}>
                  {pricingList.map((item) => (
                    <Text key={item.id ?? item.priceKey}>
                      {item.priceKey}: {getPriceSummary(item)}
                    </Text>
                  ))}
                </Flexbox>
                <Form onFinish={() => void handleCreatePricing()}>
                  <Flexbox gap={8}>
                    <Text>
                      {t('billingNative.admin.platformCatalog.newPriceVersion', '新建价格版本')}
                    </Text>
                    <Form.Item label={'credits / 1M input tokens'}>
                      <InputNumber
                        value={inputPrice}
                        onChange={(value) => setInputPrice(value ?? undefined)}
                      />
                    </Form.Item>
                    <Form.Item label={'credits / 1M output tokens'}>
                      <InputNumber
                        value={outputPrice}
                        onChange={(value) => setOutputPrice(value ?? undefined)}
                      />
                    </Form.Item>
                    <Form.Item label={'credits / image'}>
                      <InputNumber
                        value={fixedPrice}
                        onChange={(value) => setFixedPrice(value ?? undefined)}
                      />
                    </Form.Item>
                    <Form.Item
                      label={t('billingNative.admin.platformCatalog.effectiveAt', '生效时间')}
                    >
                      <DatePicker
                        showTime
                        onChange={(_, value) =>
                          setEffectiveAt(
                            typeof value === 'string' && value ? new Date(value) : undefined,
                          )
                        }
                      />
                    </Form.Item>
                    <Select
                      value={pricingModality}
                      options={[
                        { label: 'text', value: 'text' },
                        { label: 'image', value: 'image' },
                        { label: 'video', value: 'video' },
                      ]}
                      onChange={(value) => setPricingModality(value as PricingModality)}
                    />
                    <Button
                      icon={<Icon icon={DollarSignIcon} />}
                      type={'primary'}
                      onClick={() => void handleCreatePricing()}
                    >
                      {t('billingNative.admin.platformCatalog.createPriceVersion', '创建价格版本')}
                    </Button>
                  </Flexbox>
                </Form>
              </Flexbox>
            )}
          </Flexbox>
        ) : null}
      </Drawer>
    </Flexbox>
  );
});

PlatformCatalog.displayName = 'PlatformCatalog';

export default PlatformCatalog;
