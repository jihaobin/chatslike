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
  premium: { month: 3990, year: 39_900 },
  starter: { month: 1990, year: 19_900 },
  ultimate: { month: 7990, year: 79_900 },
} as const;
