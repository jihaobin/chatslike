export const BILLING_CURRENCY = 'CNY';
export const TEMPORARY_TEST_PRICE_SOURCE = 'temporary_test';

export const TOP_UP_PRODUCTS = [
  {
    amountCents: 600,
    credits: 5_000_000,
    id: 'topup_5m',
    name: '5M',
    priceSource: TEMPORARY_TEST_PRICE_SOURCE,
  },
  {
    amountCents: 1200,
    credits: 10_000_000,
    id: 'topup_10m',
    name: '10M',
    priceSource: TEMPORARY_TEST_PRICE_SOURCE,
  },
  {
    amountCents: 2400,
    credits: 20_000_000,
    id: 'topup_20m',
    name: '20M',
    priceSource: TEMPORARY_TEST_PRICE_SOURCE,
  },
  {
    amountCents: 6000,
    credits: 50_000_000,
    id: 'topup_50m',
    name: '50M',
    priceSource: TEMPORARY_TEST_PRICE_SOURCE,
  },
  {
    amountCents: 12_000,
    credits: 100_000_000,
    id: 'topup_100m',
    name: '100M',
    priceSource: TEMPORARY_TEST_PRICE_SOURCE,
  },
  {
    amountCents: 60_000,
    credits: 500_000_000,
    id: 'topup_500m',
    name: '500M',
    priceSource: TEMPORARY_TEST_PRICE_SOURCE,
  },
] as const;

export type TopUpProductId = (typeof TOP_UP_PRODUCTS)[number]['id'];
