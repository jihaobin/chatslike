import { createHash, randomInt } from 'node:crypto';

import { PHONE_VERIFICATION_CODE_LENGTH } from './constants';

export const normalizePhoneNumber = (phoneNumber: string) => {
  return phoneNumber.trim().replaceAll(/[\s\-()]/g, '');
};

export const maskPhoneNumber = (phoneNumber: string) => {
  const normalized = normalizePhoneNumber(phoneNumber);
  if (normalized.length <= 4) return '****';
  if (normalized.length <= 8) return `${normalized.slice(0, 2)}****${normalized.slice(-2)}`;

  return `${normalized.slice(0, 6)}****${normalized.slice(-4)}`;
};

export const generateVerificationCode = () => {
  const upperBound = 10 ** PHONE_VERIFICATION_CODE_LENGTH;
  return randomInt(0, upperBound).toString().padStart(PHONE_VERIFICATION_CODE_LENGTH, '0');
};

export const createVerificationCodeHash = ({
  code,
  phoneNumber,
  secret,
}: {
  code: string;
  phoneNumber: string;
  secret: string;
}) => {
  return createHash('sha256')
    .update(`${normalizePhoneNumber(phoneNumber)}:${code}:${secret}`)
    .digest('hex');
};
