import { timingSafeEqual } from 'node:crypto';

import { TRPCError } from '@trpc/server';

import type { BaseRedisProvider } from '@/libs/redis';
import type { SmsProvider } from '@/server/services/sms';

import {
  PHONE_VERIFICATION_CODE_TTL_SECONDS,
  PHONE_VERIFICATION_MAX_ATTEMPTS,
  PHONE_VERIFICATION_REDIS_PREFIX,
  PHONE_VERIFICATION_RESEND_COOLDOWN_SECONDS,
} from './constants';
import {
  createVerificationCodeHash,
  generateVerificationCode,
  maskPhoneNumber,
  normalizePhoneNumber,
} from './utils';

interface PhoneVerificationServiceOptions {
  redis: BaseRedisProvider | null;
  secret: string;
  smsProvider: SmsProvider;
}

interface VerifyCodeParams {
  code: string;
  phoneNumber: string;
}

export class PhoneVerificationService {
  constructor(private readonly options: PhoneVerificationServiceOptions) {}

  async sendCode(phoneNumber: string) {
    const redis = this.requireRedis();
    const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
    const keys = this.getKeys(normalizedPhoneNumber);
    const cooldownExists = await redis.exists(keys.cooldown);

    if (cooldownExists > 0) {
      throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'PHONE_CODE_SEND_TOO_FREQUENT' });
    }

    const code = generateVerificationCode();
    const codeHash = createVerificationCodeHash({
      code,
      phoneNumber: normalizedPhoneNumber,
      secret: this.options.secret,
    });

    await redis.setex(keys.code, PHONE_VERIFICATION_CODE_TTL_SECONDS, codeHash);
    await redis.del(keys.attempts);
    await redis.setex(keys.cooldown, PHONE_VERIFICATION_RESEND_COOLDOWN_SECONDS, '1');

    try {
      await this.options.smsProvider.sendVerificationCode({
        code,
        phoneNumber: normalizedPhoneNumber,
      });
    } catch (error) {
      await redis.del(keys.code, keys.attempts, keys.cooldown);
      throw error;
    }

    return {
      cooldownSeconds: PHONE_VERIFICATION_RESEND_COOLDOWN_SECONDS,
      maskedPhone: maskPhoneNumber(normalizedPhoneNumber),
    };
  }

  async verifyCode({ code, phoneNumber }: VerifyCodeParams) {
    const redis = this.requireRedis();
    const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
    const keys = this.getKeys(normalizedPhoneNumber);
    const storedHash = await redis.get(keys.code);

    if (!storedHash) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'PHONE_CODE_EXPIRED' });
    }

    const expectedHash = createVerificationCodeHash({
      code,
      phoneNumber: normalizedPhoneNumber,
      secret: this.options.secret,
    });

    if (this.safeEqual(storedHash, expectedHash)) {
      await redis.del(keys.code, keys.attempts, keys.cooldown);

      return { normalizedPhoneNumber };
    }

    const failedAttempts = await redis.incr(keys.attempts);
    if (failedAttempts === 1)
      await redis.expire(keys.attempts, PHONE_VERIFICATION_CODE_TTL_SECONDS);

    if (failedAttempts >= PHONE_VERIFICATION_MAX_ATTEMPTS) {
      await redis.del(keys.code, keys.attempts, keys.cooldown);
      throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'PHONE_CODE_ATTEMPTS_EXCEEDED' });
    }

    throw new TRPCError({ code: 'BAD_REQUEST', message: 'PHONE_CODE_INVALID' });
  }

  private requireRedis() {
    if (!this.options.redis) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'PHONE_VERIFICATION_REDIS_REQUIRED',
      });
    }

    return this.options.redis;
  }

  private getKeys(phoneNumber: string) {
    return {
      attempts: `${PHONE_VERIFICATION_REDIS_PREFIX}:attempts:${phoneNumber}`,
      code: `${PHONE_VERIFICATION_REDIS_PREFIX}:code:${phoneNumber}`,
      cooldown: `${PHONE_VERIFICATION_REDIS_PREFIX}:cooldown:${phoneNumber}`,
    };
  }

  private safeEqual(left: string, right: string) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    if (leftBuffer.length !== rightBuffer.length) return false;

    return timingSafeEqual(leftBuffer, rightBuffer);
  }
}
