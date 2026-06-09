'use client';

import {
  Button,
  DatePicker,
  Flexbox,
  InputNumber,
  Modal,
  Select,
  Text,
  TextArea,
} from '@lobehub/ui';
import { App } from 'antd';
import { cssVar } from 'antd-style';
import dayjs, { type Dayjs } from 'dayjs';
import type { Pricing } from 'model-bank';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ProviderPricingRecord } from '@/services/providerPricing';
import { providerPricingService } from '@/services/providerPricing';

import {
  computeFixedMultiplierPricing,
  computeTokenMultiplierPricing,
  formatCreditRate,
  toDisplayMillionCredits,
  toStoredMillionCredits,
} from './pricingConversion';

interface PriceVersionModalProps {
  currentPricing?: ProviderPricingRecord;
  model: string;
  modelType?: string;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => Promise<void> | void;
  open: boolean;
  provider: string;
  scope: 'global' | 'user';
  upstreamPricing?: Pricing;
}

const defaultCurrency = 'CNY';
const defaultMultiplier = 1;
const minCreditValue = 1;
const minMillionCreditValue = 0.001;
const millionCreditPrecision = 6;

type PricingModality = 'text' | 'image' | 'video';
type ImagePricingMode = 'fixed' | 'token';
type PricingMode = 'manual' | 'multiplier';

const hasPositivePriceDimension = (values: {
  fixedCreditsPerUnit?: number;
  imagePricingMode: ImagePricingMode;
  inputCreditsPerMillionTokens?: number;
  modality: PricingModality;
  outputCreditsPerMillionTokens?: number;
}) => {
  if (values.modality === 'image' && values.imagePricingMode === 'fixed') {
    return typeof values.fixedCreditsPerUnit === 'number' && values.fixedCreditsPerUnit > 0;
  }

  return (
    typeof values.inputCreditsPerMillionTokens === 'number' &&
    values.inputCreditsPerMillionTokens > 0 &&
    typeof values.outputCreditsPerMillionTokens === 'number' &&
    values.outputCreditsPerMillionTokens > 0
  );
};

const normalizeNumber = (value: number | string | null) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value) return Number(value);
};

const getPricingModality = (modelType?: string): PricingModality => {
  if (modelType === 'image') return 'image';
  if (modelType === 'video') return 'video';
  return 'text';
};

const getInitialImagePricingMode = (pricing?: ProviderPricingRecord): ImagePricingMode => {
  if (typeof pricing?.fixedCreditsPerUnit === 'number') return 'fixed';
  return 'token';
};

const toOptionalNumber = (value?: number | null) => (typeof value === 'number' ? value : undefined);

const getFixedRate = (unit: Pricing['units'][number]) => ('rate' in unit ? unit.rate : undefined);

const PriceVersionModal = memo<PriceVersionModalProps>(
  ({
    currentPricing,
    model,
    modelType,
    onOpenChange,
    onSuccess,
    open,
    provider,
    scope,
    upstreamPricing,
  }) => {
    const { t } = useTranslation(['modelProvider', 'common']);
    const { message } = App.useApp();
    const [reason, setReason] = useState('');
    const [effectiveAt, setEffectiveAt] = useState<Dayjs | null>(null);
    const [fixedCreditsPerUnit, setFixedCreditsPerUnit] = useState<number>();
    const [imagePricingMode, setImagePricingMode] = useState<ImagePricingMode>('token');
    const [inputCreditsPerMillionTokens, setInputCreditsPerMillionTokens] = useState<number>();
    const [loading, setLoading] = useState(false);
    const [multiplier, setMultiplier] = useState(defaultMultiplier);
    const [outputCreditsPerMillionTokens, setOutputCreditsPerMillionTokens] = useState<number>();
    const [pricingMode, setPricingMode] = useState<PricingMode>('manual');
    const modality = getPricingModality(modelType);
    const textInputUnit = upstreamPricing?.units.find(
      (unit) => unit.name === 'textInput' && unit.unit === 'millionTokens',
    );
    const textOutputUnit = upstreamPricing?.units.find(
      (unit) => unit.name === 'textOutput' && unit.unit === 'millionTokens',
    );
    const imageUnit = upstreamPricing?.units.find(
      (unit) => unit.name === 'imageGeneration' && unit.unit === 'image',
    );
    const videoUnit = upstreamPricing?.units.find(
      (unit) =>
        unit.name === 'videoGeneration' && (unit.unit === 'video' || unit.unit === 'second'),
    );
    const tokenMultiplierPayload =
      textInputUnit && textOutputUnit
        ? computeTokenMultiplierPricing({
            inputPrice: getFixedRate(textInputUnit) ?? 0,
            multiplier,
            outputPrice: getFixedRate(textOutputUnit) ?? 0,
          })
        : undefined;
    const fixedMultiplierPayload =
      modality === 'image' && imageUnit
        ? computeFixedMultiplierPricing({
            multiplier,
            price: getFixedRate(imageUnit) ?? 0,
            unit: 'image',
          })
        : modality === 'video' &&
            videoUnit &&
            (videoUnit.unit === 'video' || videoUnit.unit === 'second')
          ? computeFixedMultiplierPricing({
              multiplier,
              price: getFixedRate(videoUnit) ?? 0,
              unit: videoUnit.unit,
            })
          : undefined;
    const showTokenPricing = modality !== 'image' || imagePricingMode === 'token';
    const showFixedPricing = modality === 'image' && imagePricingMode === 'fixed';

    const reset = () => {
      setEffectiveAt(null);
      setFixedCreditsPerUnit(undefined);
      setImagePricingMode('token');
      setInputCreditsPerMillionTokens(undefined);
      setOutputCreditsPerMillionTokens(undefined);
      setPricingMode(upstreamPricing?.units?.length ? 'multiplier' : 'manual');
      setReason('');
    };

    useEffect(() => {
      if (!open) return;

      setImagePricingMode(getInitialImagePricingMode(currentPricing));
      setFixedCreditsPerUnit(toOptionalNumber(currentPricing?.fixedCreditsPerUnit));
      setInputCreditsPerMillionTokens(
        currentPricing?.inputCreditsPerMillionTokens
          ? toDisplayMillionCredits(currentPricing.inputCreditsPerMillionTokens)
          : undefined,
      );
      setMultiplier(currentPricing?.sellRate ?? defaultMultiplier);
      setOutputCreditsPerMillionTokens(
        currentPricing?.outputCreditsPerMillionTokens
          ? toDisplayMillionCredits(currentPricing.outputCreditsPerMillionTokens)
          : undefined,
      );
      setPricingMode(upstreamPricing?.units?.length ? 'multiplier' : 'manual');
    }, [currentPricing, open, upstreamPricing]);

    const close = () => onOpenChange(false);
    const canSubmit =
      !!reason.trim() &&
      (pricingMode === 'multiplier'
        ? Boolean(tokenMultiplierPayload ?? fixedMultiplierPayload)
        : hasPositivePriceDimension({
            fixedCreditsPerUnit,
            imagePricingMode,
            inputCreditsPerMillionTokens,
            modality,
            outputCreditsPerMillionTokens,
          }));

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
              const shouldSubmitFixedPricing = modality === 'image' && imagePricingMode === 'fixed';
              const shouldSubmitTokenPricing = !shouldSubmitFixedPricing;
              const manualTokenPayload = shouldSubmitTokenPricing
                ? {
                    inputCreditsPerMillionTokens: inputCreditsPerMillionTokens
                      ? toStoredMillionCredits(inputCreditsPerMillionTokens)
                      : undefined,
                    outputCreditsPerMillionTokens: outputCreditsPerMillionTokens
                      ? toStoredMillionCredits(outputCreditsPerMillionTokens)
                      : undefined,
                  }
                : {};
              const manualFixedPayload = shouldSubmitFixedPricing
                ? { fixedCreditsPerUnit, unit: modality === 'image' ? 'image' : undefined }
                : {};
              const multiplierPayload =
                pricingMode === 'multiplier'
                  ? (tokenMultiplierPayload ?? fixedMultiplierPayload)
                  : undefined;
              const pricingPayload =
                pricingMode === 'multiplier'
                  ? multiplierPayload
                  : { ...manualTokenPayload, ...manualFixedPayload };

              if (
                !pricingPayload ||
                (pricingMode === 'manual' &&
                  !hasPositivePriceDimension({
                    fixedCreditsPerUnit,
                    imagePricingMode,
                    inputCreditsPerMillionTokens,
                    modality,
                    outputCreditsPerMillionTokens,
                  }))
              ) {
                message.error(t('providerPricing.price.required'));
                return;
              }

              setLoading(true);
              try {
                await providerPricingService.createModelPricingVersion({
                  currency: defaultCurrency,
                  ...(effectiveAt ? { effectiveAt: effectiveAt.toDate() } : {}),
                  ...pricingPayload,
                  ...(pricingMode === 'manual' && shouldSubmitTokenPricing
                    ? { fixedCreditsPerUnit: undefined, unit: undefined }
                    : {}),
                  ...(pricingMode === 'manual' && shouldSubmitFixedPricing
                    ? {
                        inputCreditsPerMillionTokens: undefined,
                        outputCreditsPerMillionTokens: undefined,
                      }
                    : {}),
                  model,
                  modality,
                  provider,
                  reason: trimmedReason,
                  scope,
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
          <Flexbox
            gap={8}
            padding={12}
            style={{ border: `1px solid ${cssVar.colorBorderSecondary}`, borderRadius: 8 }}
          >
            <Text strong>{t('providerPricing.price.mode.title')}</Text>
            <Select
              value={pricingMode}
              options={[
                {
                  disabled: !upstreamPricing?.units?.length,
                  label: t('providerPricing.price.mode.multiplier'),
                  value: 'multiplier',
                },
                { label: t('providerPricing.price.mode.manual'), value: 'manual' },
              ]}
              onChange={(value) => setPricingMode(value === 'multiplier' ? 'multiplier' : 'manual')}
            />
          </Flexbox>
          {modality === 'image' && (
            <Flexbox gap={4}>
              <Text style={{ color: cssVar.colorTextSecondary, fontSize: cssVar.fontSizeSM }}>
                {t('providerPricing.price.imageMode')}
              </Text>
              <Select
                value={imagePricingMode}
                options={[
                  { label: t('providerPricing.price.imageMode.token'), value: 'token' },
                  { label: t('providerPricing.price.imageMode.fixed'), value: 'fixed' },
                ]}
                onChange={(value) => {
                  if (value === 'fixed' || value === 'token') {
                    setImagePricingMode(value);
                    setFixedCreditsPerUnit(undefined);
                    setInputCreditsPerMillionTokens(undefined);
                    setOutputCreditsPerMillionTokens(undefined);
                  }
                }}
              />
            </Flexbox>
          )}
          {pricingMode === 'multiplier' && (
            <Flexbox
              gap={8}
              padding={12}
              style={{ border: `1px solid ${cssVar.colorBorderSecondary}`, borderRadius: 8 }}
            >
              <Text strong>{t('providerPricing.price.original.title')}</Text>
              <Text>{t('providerPricing.price.original.desc')}</Text>
              {upstreamPricing?.units.map((unit) => (
                <Text key={`${unit.name}-${unit.unit}`}>
                  {'rate' in unit ? `${unit.rate} / M tokens` : '-'}
                </Text>
              ))}
              <InputNumber
                aria-label={t('providerPricing.price.multiplier.label')}
                min={0.0001}
                precision={4}
                step={0.1}
                value={multiplier}
                onChange={(value) => setMultiplier(normalizeNumber(value) ?? defaultMultiplier)}
              />
            </Flexbox>
          )}
          {pricingMode === 'manual' && showTokenPricing && (
            <>
              <Flexbox gap={4}>
                <Text style={{ color: cssVar.colorTextSecondary, fontSize: cssVar.fontSizeSM }}>
                  {t('providerPricing.price.inputCredits')}
                </Text>
                <InputNumber
                  min={minMillionCreditValue}
                  placeholder={t('providerPricing.price.inputCredits.placeholder')}
                  precision={millionCreditPrecision}
                  step={minMillionCreditValue}
                  value={inputCreditsPerMillionTokens}
                  onChange={(value) => setInputCreditsPerMillionTokens(normalizeNumber(value))}
                />
              </Flexbox>
              <Flexbox gap={4}>
                <Text style={{ color: cssVar.colorTextSecondary, fontSize: cssVar.fontSizeSM }}>
                  {t('providerPricing.price.outputCredits')}
                </Text>
                <InputNumber
                  min={minMillionCreditValue}
                  placeholder={t('providerPricing.price.outputCredits.placeholder')}
                  precision={millionCreditPrecision}
                  step={minMillionCreditValue}
                  value={outputCreditsPerMillionTokens}
                  onChange={(value) => setOutputCreditsPerMillionTokens(normalizeNumber(value))}
                />
              </Flexbox>
            </>
          )}
          {pricingMode === 'manual' && showFixedPricing && (
            <Flexbox gap={4}>
              <Text style={{ color: cssVar.colorTextSecondary, fontSize: cssVar.fontSizeSM }}>
                {t('providerPricing.price.fixedCredits.image')}
              </Text>
              <InputNumber
                min={minCreditValue}
                placeholder={t('providerPricing.price.fixedCredits.image.placeholder')}
                precision={0}
                step={1}
                value={fixedCreditsPerUnit}
                onChange={(value) => setFixedCreditsPerUnit(normalizeNumber(value))}
              />
            </Flexbox>
          )}
          <Flexbox
            gap={8}
            padding={12}
            style={{ border: `1px solid ${cssVar.colorBorderSecondary}`, borderRadius: 8 }}
          >
            <Text strong>{t('providerPricing.price.preview.title')}</Text>
            <Text>{t('providerPricing.price.preview.desc')}</Text>
            {tokenMultiplierPayload && pricingMode === 'multiplier' && (
              <Text>
                {formatCreditRate(
                  tokenMultiplierPayload.inputCreditsPerMillionTokens,
                  'millionTokens',
                )}{' '}
                ·{' '}
                {formatCreditRate(
                  tokenMultiplierPayload.outputCreditsPerMillionTokens,
                  'millionTokens',
                )}
              </Text>
            )}
            {fixedMultiplierPayload && pricingMode === 'multiplier' && (
              <Text>
                {formatCreditRate(
                  fixedMultiplierPayload.fixedCreditsPerUnit,
                  fixedMultiplierPayload.unit,
                )}
              </Text>
            )}
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
              onChange={(value) =>
                setEffectiveAt(Array.isArray(value) ? (value[0] ?? null) : value)
              }
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
