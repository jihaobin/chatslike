'use client';

import { Button, DatePicker, Flexbox, Input, InputNumber, Modal, Select, Text, TextArea } from '@lobehub/ui';
import { App } from 'antd';
import { cssVar } from 'antd-style';
import dayjs, { type Dayjs } from 'dayjs';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ProviderPricingRecord } from '@/services/providerPricing';
import { providerPricingService } from '@/services/providerPricing';

interface PriceVersionModalProps {
  currentPricing?: ProviderPricingRecord;
  model: string;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => Promise<void> | void;
  open: boolean;
  provider: string;
  scope: 'global' | 'user';
}

const defaultCurrency = 'CNY';
const defaultModality = 'text';
const defaultUnit = 'unit';
const minCreditValue = 1;

const hasPositivePriceDimension = (values: {
  fixedCreditsPerUnit?: number;
  inputCreditsPerMillionTokens?: number;
  outputCreditsPerMillionTokens?: number;
}) =>
  (typeof values.inputCreditsPerMillionTokens === 'number' &&
    values.inputCreditsPerMillionTokens > 0) ||
  (typeof values.outputCreditsPerMillionTokens === 'number' &&
    values.outputCreditsPerMillionTokens > 0) ||
  (typeof values.fixedCreditsPerUnit === 'number' && values.fixedCreditsPerUnit > 0);

const normalizeNumber = (value: number | string | null) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value) return Number(value);
};

const isModality = (value: string): value is 'text' | 'image' | 'video' =>
  value === 'text' || value === 'image' || value === 'video';

const toOptionalNumber = (value?: number | null) => (typeof value === 'number' ? value : undefined);

const toOptionalString = (value?: string | null) => (value ? value : undefined);

const PriceVersionModal = memo<PriceVersionModalProps>(
  ({ currentPricing, model, onOpenChange, onSuccess, open, provider, scope }) => {
    const { t } = useTranslation(['modelProvider', 'common']);
    const { message } = App.useApp();
    const [reason, setReason] = useState('');
    const [currency, setCurrency] = useState(defaultCurrency);
    const [effectiveAt, setEffectiveAt] = useState<Dayjs | null>(null);
    const [fixedCreditsPerUnit, setFixedCreditsPerUnit] = useState<number>();
    const [inputCreditsPerMillionTokens, setInputCreditsPerMillionTokens] = useState<number>();
    const [loading, setLoading] = useState(false);
    const [modality, setModality] = useState<'text' | 'image' | 'video'>(defaultModality);
    const [outputCreditsPerMillionTokens, setOutputCreditsPerMillionTokens] = useState<number>();
    const [unit, setUnit] = useState(defaultUnit);

    const reset = () => {
      setCurrency(defaultCurrency);
      setEffectiveAt(null);
      setFixedCreditsPerUnit(undefined);
      setInputCreditsPerMillionTokens(undefined);
      setModality(defaultModality);
      setOutputCreditsPerMillionTokens(undefined);
      setReason('');
      setUnit(defaultUnit);
    };

    useEffect(() => {
      if (!open) return;

      setCurrency(toOptionalString(currentPricing?.currency) ?? defaultCurrency);
      setFixedCreditsPerUnit(toOptionalNumber(currentPricing?.fixedCreditsPerUnit));
      setInputCreditsPerMillionTokens(toOptionalNumber(currentPricing?.inputCreditsPerMillionTokens));
      setOutputCreditsPerMillionTokens(toOptionalNumber(currentPricing?.outputCreditsPerMillionTokens));
      setUnit(toOptionalString(currentPricing?.unit) ?? defaultUnit);
    }, [currentPricing, open]);

    const close = () => onOpenChange(false);
    const canSubmit =
      !!reason.trim() &&
      hasPositivePriceDimension({ fixedCreditsPerUnit, inputCreditsPerMillionTokens, outputCreditsPerMillionTokens });

    return (
      <Modal
        destroyOnHidden
        maskClosable
        open={open}
        title={t('providerPricing.create')}
        footer={[
          <Button key="cancel" onClick={close}>
            {t('cancel', { ns: 'common' })}
          </Button>,
          <Button
            disabled={!canSubmit}
            key="ok"
            loading={loading}
            style={{ marginInlineStart: 16 }}
            type="primary"
            onClick={async () => {
              const trimmedReason = reason.trim();
              if (!trimmedReason) return;
              if (
                !hasPositivePriceDimension({
                  fixedCreditsPerUnit,
                  inputCreditsPerMillionTokens,
                  outputCreditsPerMillionTokens,
                })
              ) {
                message.error(t('providerPricing.price.required'));
                return;
              }

              setLoading(true);
              try {
                await providerPricingService.createModelPricingVersion({
                  currency,
                  ...(effectiveAt ? { effectiveAt: effectiveAt.toDate() } : {}),
                  fixedCreditsPerUnit,
                  inputCreditsPerMillionTokens,
                  model,
                  modality,
                  outputCreditsPerMillionTokens,
                  provider,
                  reason: trimmedReason,
                  scope,
                  unit,
                });
                await onSuccess?.();
                message.success(t('providerPricing.createSuccess'));
                reset();
                close();
              } catch (error) {
                console.error('[providerPricing:createModelPricingVersion]', error);
                message.error(t('providerPricing.createFailed'));
              } finally {
                setLoading(false);
              }
            }}
          >
            {t('ok', { ns: 'common' })}
          </Button>,
        ]}
        onCancel={close}
      >
        <Flexbox gap={12}>
          <Flexbox gap={4}>
            <Text style={{ color: cssVar.colorTextSecondary, fontSize: cssVar.fontSizeSM }}>
              {t('providerPricing.price.inputCredits')}
            </Text>
              <InputNumber
              min={minCreditValue}
              placeholder={t('providerPricing.price.inputCredits.placeholder')}
              precision={0}
              step={1}
              value={inputCreditsPerMillionTokens}
              onChange={(value) => setInputCreditsPerMillionTokens(normalizeNumber(value))}
            />
          </Flexbox>
          <Flexbox gap={4}>
            <Text style={{ color: cssVar.colorTextSecondary, fontSize: cssVar.fontSizeSM }}>
              {t('providerPricing.price.outputCredits')}
            </Text>
              <InputNumber
              min={minCreditValue}
              placeholder={t('providerPricing.price.outputCredits.placeholder')}
              precision={0}
              step={1}
              value={outputCreditsPerMillionTokens}
              onChange={(value) => setOutputCreditsPerMillionTokens(normalizeNumber(value))}
            />
          </Flexbox>
          <Flexbox horizontal gap={12}>
            <Flexbox flex={1} gap={4}>
              <Text style={{ color: cssVar.colorTextSecondary, fontSize: cssVar.fontSizeSM }}>
                {t('providerPricing.price.fixedCredits')}
              </Text>
                <InputNumber
                min={minCreditValue}
                placeholder={t('providerPricing.price.fixedCredits.placeholder')}
                precision={0}
                step={1}
                value={fixedCreditsPerUnit}
                onChange={(value) => setFixedCreditsPerUnit(normalizeNumber(value))}
              />
            </Flexbox>
            <Flexbox flex={1} gap={4}>
              <Text style={{ color: cssVar.colorTextSecondary, fontSize: cssVar.fontSizeSM }}>
                {t('providerPricing.price.unit')}
              </Text>
              <Input value={unit} onChange={(event) => setUnit(event.target.value || defaultUnit)} />
            </Flexbox>
          </Flexbox>
          <Flexbox horizontal gap={12}>
            <Flexbox flex={1} gap={4}>
              <Text style={{ color: cssVar.colorTextSecondary, fontSize: cssVar.fontSizeSM }}>
                {t('providerPricing.price.currency')}
              </Text>
              <Input value={currency} onChange={(event) => setCurrency(event.target.value || defaultCurrency)} />
            </Flexbox>
            <Flexbox flex={1} gap={4}>
              <Text style={{ color: cssVar.colorTextSecondary, fontSize: cssVar.fontSizeSM }}>
                {t('providerPricing.price.modality')}
              </Text>
              <Select
                options={[
                  { label: t('providerPricing.price.modality.text'), value: 'text' },
                  { label: t('providerPricing.price.modality.image'), value: 'image' },
                  { label: t('providerPricing.price.modality.video'), value: 'video' },
                ]}
                value={modality}
                onChange={(value) => {
                  if (typeof value === 'string' && isModality(value)) setModality(value);
                }}
              />
            </Flexbox>
          </Flexbox>
          <Flexbox gap={4}>
            <Text style={{ color: cssVar.colorTextSecondary, fontSize: cssVar.fontSizeSM }}>
              {t('providerPricing.effectiveAt')}
            </Text>
            <DatePicker
              minDate={dayjs()}
              placeholder={t('providerPricing.effectiveAt.placeholder')}
              showNow={false}
              value={effectiveAt}
              onChange={(value) => setEffectiveAt(Array.isArray(value) ? (value[0] ?? null) : value)}
            />
          </Flexbox>
          <TextArea
            autoFocus
            placeholder={t('providerPricing.reason.placeholder')}
            style={{ minHeight: 96 }}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </Flexbox>
      </Modal>
    );
  },
);

PriceVersionModal.displayName = 'PriceVersionModal';

export default PriceVersionModal;
