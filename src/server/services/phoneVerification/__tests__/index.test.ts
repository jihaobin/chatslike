// @vitest-environment node
import type { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  BaseRedisProvider,
  RedisKey,
  RedisMSetArgument,
  RedisSetResult,
  RedisValue,
  SetOptions,
} from '@/libs/redis';
import type { SmsProvider } from '@/server/services/sms';

import { PhoneVerificationService } from '..';

class MemoryRedisProvider implements BaseRedisProvider {
  private readonly values = new Map<string, string>();
  private readonly expirations = new Map<string, number>();

  async initialize() {}
  async disconnect() {}

  async get(key: RedisKey) {
    return this.values.get(String(key)) ?? null;
  }

  async set(key: RedisKey, value: RedisValue, options?: SetOptions): Promise<RedisSetResult> {
    const stringKey = String(key);
    if (options?.nx && this.values.has(stringKey)) return null;
    this.values.set(stringKey, String(value));
    if (options?.ex) this.expirations.set(stringKey, options.ex);
    return 'OK';
  }

  async setex(key: RedisKey, seconds: number, value: RedisValue) {
    this.values.set(String(key), String(value));
    this.expirations.set(String(key), seconds);
    return 'OK' as const;
  }

  async del(...keys: RedisKey[]) {
    let deleted = 0;
    for (const key of keys.map(String)) {
      if (this.values.delete(key)) deleted += 1;
      this.expirations.delete(key);
    }
    return deleted;
  }

  async exists(...keys: RedisKey[]) {
    return keys.filter((key) => this.values.has(String(key))).length;
  }

  async expire(key: RedisKey, seconds: number) {
    this.expirations.set(String(key), seconds);
    return this.values.has(String(key)) ? 1 : 0;
  }

  async ttl(key: RedisKey) {
    return this.expirations.get(String(key)) ?? -1;
  }

  async incr(key: RedisKey) {
    const stringKey = String(key);
    const next = Number(this.values.get(stringKey) ?? 0) + 1;
    this.values.set(stringKey, String(next));
    return next;
  }

  async decr(key: RedisKey) {
    const stringKey = String(key);
    const next = Number(this.values.get(stringKey) ?? 0) - 1;
    this.values.set(stringKey, String(next));
    return next;
  }

  async mget(...keys: RedisKey[]) {
    return Promise.all(keys.map((key) => this.get(key)));
  }

  async mset(values: RedisMSetArgument) {
    const entries = values instanceof Map ? values.entries() : Object.entries(values);
    for (const [key, value] of entries) this.values.set(String(key), String(value));
    return 'OK' as const;
  }

  async hget() {
    return null;
  }

  async hset() {
    return 0;
  }

  async hdel() {
    return 0;
  }

  async hgetall() {
    return {};
  }

  async eval<T = unknown>() {
    return undefined as T;
  }

  pipeline(): ReturnType<BaseRedisProvider['pipeline']> {
    throw new Error('pipeline is not used');
  }
}

describe('PhoneVerificationService', () => {
  const smsProvider: SmsProvider = {
    sendVerificationCode: vi.fn().mockResolvedValue({ bizId: 'biz', requestId: 'req' }),
  };
  let redis: MemoryRedisProvider;

  beforeEach(() => {
    redis = new MemoryRedisProvider();
    vi.clearAllMocks();
  });

  it('should send code, store hash, and return masked phone with cooldown', async () => {
    const service = new PhoneVerificationService({ redis, secret: 'secret', smsProvider });

    const result = await service.sendCode('+86 138 0000 0000');

    expect(result).toEqual({ cooldownSeconds: 60, maskedPhone: '+86138****0000' });
    expect(smsProvider.sendVerificationCode).toHaveBeenCalledWith({
      code: expect.stringMatching(/^\d{6}$/),
      phoneNumber: '+8613800000000',
    });
  });

  it('should block resend during cooldown', async () => {
    const service = new PhoneVerificationService({ redis, secret: 'secret', smsProvider });

    await service.sendCode('+8613800000000');

    await expect(service.sendCode('+8613800000000')).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
    } satisfies Partial<TRPCError>);
  });

  it('should verify a correct code and clear stored state', async () => {
    const service = new PhoneVerificationService({ redis, secret: 'secret', smsProvider });
    await service.sendCode('+8613800000000');
    const sentCode = vi.mocked(smsProvider.sendVerificationCode).mock.calls[0][0].code;

    const result = await service.verifyCode({ code: sentCode, phoneNumber: '+8613800000000' });

    expect(result).toEqual({ normalizedPhoneNumber: '+8613800000000' });
    await expect(
      service.verifyCode({ code: sentCode, phoneNumber: '+8613800000000' }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    } satisfies Partial<TRPCError>);
  });

  it('should allow correct code after two failed attempts', async () => {
    const service = new PhoneVerificationService({ redis, secret: 'secret', smsProvider });
    await service.sendCode('+8613800000000');
    const sentCode = vi.mocked(smsProvider.sendVerificationCode).mock.calls[0][0].code;

    await expect(
      service.verifyCode({ code: '000000', phoneNumber: '+8613800000000' }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    await expect(
      service.verifyCode({ code: '111111', phoneNumber: '+8613800000000' }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });

    await expect(
      service.verifyCode({ code: sentCode, phoneNumber: '+8613800000000' }),
    ).resolves.toEqual({
      normalizedPhoneNumber: '+8613800000000',
    });
  });

  it('should clean stored state when SMS provider fails', async () => {
    vi.mocked(smsProvider.sendVerificationCode).mockRejectedValueOnce(new Error('send failed'));
    const service = new PhoneVerificationService({ redis, secret: 'secret', smsProvider });

    await expect(service.sendCode('+8613800000000')).rejects.toThrow('send failed');
    await expect(service.sendCode('+8613800000000')).resolves.toEqual({
      cooldownSeconds: 60,
      maskedPhone: '+86138****0000',
    });
  });

  it('should reject wrong code and stop after three failed attempts', async () => {
    const service = new PhoneVerificationService({ redis, secret: 'secret', smsProvider });
    await service.sendCode('+8613800000000');

    await expect(
      service.verifyCode({ code: '000000', phoneNumber: '+8613800000000' }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    await expect(
      service.verifyCode({ code: '111111', phoneNumber: '+8613800000000' }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    await expect(
      service.verifyCode({ code: '222222', phoneNumber: '+8613800000000' }),
    ).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
    });
    await expect(
      service.verifyCode({ code: '333333', phoneNumber: '+8613800000000' }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });
});
