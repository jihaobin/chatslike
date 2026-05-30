import { billingEnv } from './env';

export {
  BILLING_CURRENCY,
  TEMPORARY_TEST_PRICE_SOURCE,
  TOP_UP_PRODUCTS,
} from '@/business/shared/billingProducts';

export const TRIAL_CREDITS = billingEnv.trial.credits;
export const TRIAL_VALID_DAYS = billingEnv.trial.validDays;

export const SUBSCRIPTION_PLANS = {
  premium: { creditsPerMonth: 15_000_000, id: 'premium', name: 'Premium' },
  starter: { creditsPerMonth: 5_000_000, id: 'starter', name: 'Starter' },
  ultimate: { creditsPerMonth: 35_000_000, id: 'ultimate', name: 'Ultimate' },
} as const;

export const SUBSCRIPTION_PRICE_CENTS = {
  premium: { month: 24_900, year: 249_000 },
  starter: { month: 9900, year: 99_000 },
  ultimate: { month: 49_900, year: 499_000 },
} as const;
