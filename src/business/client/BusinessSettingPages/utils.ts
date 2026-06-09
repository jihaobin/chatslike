export const formatBillingAmount = (
  amountCents: number,
  currency = 'CNY',
  options: Intl.NumberFormatOptions = {},
) => {
  const amount = (amountCents / 100).toLocaleString('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    ...options,
  });

  return `${currency === 'CNY' ? '¥' : currency} ${amount}`;
};
