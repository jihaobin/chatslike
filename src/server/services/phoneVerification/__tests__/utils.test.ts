// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  createVerificationCodeHash,
  generateVerificationCode,
  maskPhoneNumber,
  normalizePhoneNumber,
} from '../utils';

describe('phoneVerification utils', () => {
  it('should normalize phone numbers by trimming spaces and removing separators', () => {
    expect(normalizePhoneNumber(' +86 138-0000-0000 ')).toBe('+8613800000000');
    expect(normalizePhoneNumber('(138) 0000 0000')).toBe('13800000000');
  });

  it('should mask phone numbers without exposing full value', () => {
    expect(maskPhoneNumber('+8613800000000')).toBe('+86138****0000');
    expect(maskPhoneNumber('123456')).toBe('12****56');
  });

  it('should generate six digit numeric codes', () => {
    const code = generateVerificationCode();

    expect(code).toMatch(/^\d{6}$/);
  });

  it('should hash code with phone and secret', () => {
    const hash = createVerificationCodeHash({
      code: '123456',
      phoneNumber: '+8613800000000',
      secret: 'test-secret',
    });

    expect(hash).toHaveLength(64);
    expect(hash).toBe(
      createVerificationCodeHash({
        code: '123456',
        phoneNumber: '+8613800000000',
        secret: 'test-secret',
      }),
    );
  });
});
