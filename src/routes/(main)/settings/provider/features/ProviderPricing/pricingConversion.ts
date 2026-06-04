export const MILLION_CREDITS = 1_000_000;

export type SupportedPricingUnit = 'image' | 'millionTokens' | 'second' | 'video';

interface TokenMultiplierInput {
  inputPrice: number;
  multiplier: number;
  outputPrice: number;
}

interface FixedMultiplierInput {
  multiplier: number;
  price: number;
  unit: Exclude<SupportedPricingUnit, 'millionTokens'>;
}

export const toStoredMillionCredits = (displayValue: number) =>
  Math.round(displayValue * MILLION_CREDITS);

export const toDisplayMillionCredits = (storedValue: number) => storedValue / MILLION_CREDITS;

export const computeTokenMultiplierPricing = ({
  inputPrice,
  multiplier,
  outputPrice,
}: TokenMultiplierInput) => ({
  inputCreditsPerMillionTokens: toStoredMillionCredits(inputPrice * multiplier),
  outputCreditsPerMillionTokens: toStoredMillionCredits(outputPrice * multiplier),
  providerCost: inputPrice + outputPrice,
  sellRate: multiplier,
});

export const computeFixedMultiplierPricing = ({
  multiplier,
  price,
  unit,
}: FixedMultiplierInput) => ({
  fixedCreditsPerUnit: Math.round(price * multiplier * MILLION_CREDITS),
  providerCost: price,
  sellRate: multiplier,
  unit,
});

export const formatCreditRate = (credits: number, unit: SupportedPricingUnit) => {
  if (unit === 'millionTokens') {
    return `${toDisplayMillionCredits(credits).toLocaleString()}M 积分 / M tokens`;
  }

  return `${credits.toLocaleString()} 积分 / ${unit}`;
};
