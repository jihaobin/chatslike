'use client';

import { Button, Flexbox, Tag, Text } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import type { TFunction } from 'i18next';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useClientDataSWR } from '@/libs/swr';
import type { ProviderPricingRecord } from '@/services/providerPricing';
import { providerPricingService } from '@/services/providerPricing';

import PriceVersionModal from './PriceVersionModal';

interface ProviderPricingProps {
  model: string;
  provider: string;
  readonly?: boolean;
  scope: 'global' | 'user';
}

const formatDate = (value?: Date | string | null) => {
  if (!value) return undefined;

  return new Date(value).toLocaleDateString();
};

type PricingTranslator = TFunction<'modelProvider'>;

const formatPricingValue = (item: ProviderPricingRecord, t: PricingTranslator) => {
  const values = [
    typeof item.inputCreditsPerMillionTokens === 'number' &&
      t('providerPricing.value.input', { value: item.inputCreditsPerMillionTokens }),
    typeof item.outputCreditsPerMillionTokens === 'number' &&
      t('providerPricing.value.output', { value: item.outputCreditsPerMillionTokens }),
    typeof item.fixedCreditsPerUnit === 'number' &&
      t('providerPricing.value.fixed', {
        unit: item.unit ?? t('providerPricing.value.defaultUnit'),
        value: item.fixedCreditsPerUnit,
      }),
  ].filter(Boolean);

  return values.length > 0 ? values.join(' · ') : t('providerPricing.value.empty');
};

const isFuturePrice = (item: ProviderPricingRecord, now: number) => {
  if (!item.effectiveAt) return false;

  return new Date(item.effectiveAt).getTime() > now;
};

const PricingRow = memo<{ item: ProviderPricingRecord; label: string; t: PricingTranslator }>(({ item, label, t }) => (
  <Flexbox
    horizontal
    align={'center'}
    gap={8}
    justify={'space-between'}
    paddingBlock={6}
    style={{ borderBottom: `1px solid ${cssVar.colorBorderSecondary}` }}
  >
    <Flexbox gap={2} style={{ minWidth: 0 }}>
      <Flexbox horizontal align={'center'} gap={8}>
        <Tag>{label}</Tag>
        <Text style={{ color: cssVar.colorTextSecondary, fontSize: 12 }}>
          {formatDate(item.effectiveAt)}
        </Text>
      </Flexbox>
      <Text style={{ color: cssVar.colorTextSecondary, fontSize: 12 }}>{formatPricingValue(item, t)}</Text>
    </Flexbox>
    {item.status && <Tag>{item.status}</Tag>}
  </Flexbox>
));

PricingRow.displayName = 'PricingRow';

const ProviderPricing = memo<ProviderPricingProps>(({ model, provider, readonly, scope }) => {
  const { t } = useTranslation('modelProvider');
  const [open, setOpen] = useState(false);
  const canCreate = scope === 'global' && !readonly;

  const { data = [], mutate } = useClientDataSWR(['PROVIDER_PRICING', scope, provider, model], () =>
    providerPricingService.listModelPricing({ model, provider, scope }),
  );

  const grouped = useMemo(() => {
    const now = Date.now();
    const activeRows = data.filter((item) => item.status !== 'retired');
    const future = activeRows.filter((item) => isFuturePrice(item, now));
    const current = activeRows.find((item) => !isFuturePrice(item, now));
    const history = data.filter(
      (item) => item.status === 'retired' || (item.id !== current?.id && !isFuturePrice(item, now)),
    );

    return { current, future, history };
  }, [data]);

  return (
    <Flexbox gap={8} paddingBlock={8}>
      <Flexbox horizontal align={'center'} justify={'space-between'}>
        <Flexbox horizontal align={'center'} gap={8}>
          <Text strong>{t('providerPricing.title')}</Text>
          {data.length === 0 && <Tag>{t('providerPricing.gap')}</Tag>}
        </Flexbox>
        {canCreate ? (
          <Button size={'small'} type={'text'} onClick={() => setOpen(true)}>
            {t('providerPricing.create')}
          </Button>
        ) : (
          <Text style={{ color: cssVar.colorTextSecondary, fontSize: 12 }}>
            {t('providerPricing.readonly')}
          </Text>
        )}
      </Flexbox>
      <Flexbox gap={4}>
        {grouped.current && <PricingRow item={grouped.current} label={t('providerPricing.current')} t={t} />}
        {grouped.future.map((item) => (
          <PricingRow item={item} key={item.id} label={t('providerPricing.future')} t={t} />
        ))}
        {grouped.history.slice(0, 3).map((item) => (
          <PricingRow item={item} key={item.id} label={t('providerPricing.history')} t={t} />
        ))}
        {data.length === 0 && (
          <Text style={{ color: cssVar.colorTextSecondary, fontSize: 12 }}>
            {t('providerPricing.empty')}
          </Text>
        )}
      </Flexbox>
      <PriceVersionModal
        currentPricing={grouped.current}
        model={model}
        open={open}
        provider={provider}
        scope={scope}
        onOpenChange={setOpen}
        onSuccess={async () => {
          await mutate();
        }}
      />
    </Flexbox>
  );
});

ProviderPricing.displayName = 'ProviderPricing';

export default ProviderPricing;
