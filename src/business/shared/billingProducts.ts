export const BILLING_CURRENCY = 'CNY';
export const TEMPORARY_TEST_PRICE_SOURCE = 'temporary_test';

export const TOP_UP_PRODUCTS = [
  {
    amountCents: 9900,
    credits: 1_000_000,
    id: 'topup_1m',
    name: '1,000,000 Credits',
    priceSource: TEMPORARY_TEST_PRICE_SOURCE,
  },
  {
    amountCents: 39_900,
    credits: 5_000_000,
    id: 'topup_5m',
    name: '5,000,000 Credits',
    priceSource: TEMPORARY_TEST_PRICE_SOURCE,
  },
  {
    amountCents: 69_900,
    credits: 10_000_000,
    id: 'topup_10m',
    name: '10,000,000 Credits',
    priceSource: TEMPORARY_TEST_PRICE_SOURCE,
  },
] as const;

export type TopUpProductId = (typeof TOP_UP_PRODUCTS)[number]['id'];
