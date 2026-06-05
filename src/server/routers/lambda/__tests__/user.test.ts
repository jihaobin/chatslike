// @vitest-environment node
import { Plans } from '@lobechat/types';
import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as BusinessUserModule from '@/business/server/user';
import * as businessUser from '@/business/server/user';
import {
  getReferralStatus,
  getSubscriptionPlan,
  onUserActivityForBusiness,
} from '@/business/server/user';
import { MessageModel } from '@/database/models/message';
import { SessionModel } from '@/database/models/session';
import { UserModel } from '@/database/models/user';
import { serverDB } from '@/database/server';
import type * as RedisModule from '@/libs/redis';
import { getServerGlobalConfig } from '@/server/globalConfig';
import { KeyVaultsGateKeeper } from '@/server/modules/KeyVaultsEncrypt';

import { userRouter } from '../user';

const mockAfterTasks = vi.hoisted((): Promise<void>[] => []);
const phoneVerificationMocks = vi.hoisted(() => ({
  sendCode: vi.fn(),
  verifyCode: vi.fn(),
}));

// Mock modules
vi.mock('next/server', () => ({
  after: (callback: () => Promise<void> | void) => {
    mockAfterTasks.push(Promise.resolve(callback()));
  },
}));

vi.mock('@/business/server/user', async (importOriginal) => {
  const actual = await importOriginal<typeof BusinessUserModule>();

  return {
    ...actual,
    getReferralStatus: vi.fn(),
    getSubscriptionPlan: vi.fn(),
    onUserActivityForBusiness: vi.fn(),
  };
});

vi.mock('@/database/server', () => ({
  serverDB: {},
}));

vi.mock('@/database/models/message');
vi.mock('@/database/models/session');
vi.mock('@/database/models/user');
vi.mock('@/server/globalConfig');
vi.mock('@/server/modules/KeyVaultsEncrypt');
vi.mock('@/server/modules/S3');
vi.mock('@/server/services/phoneVerification', () => ({
  PhoneVerificationService: vi.fn().mockImplementation(() => ({
    sendCode: phoneVerificationMocks.sendCode,
    verifyCode: phoneVerificationMocks.verifyCode,
  })),
}));
vi.mock('@/server/services/sms', () => ({
  createAliyunSmsProvider: vi.fn().mockReturnValue({ sendVerificationCode: vi.fn() }),
}));
vi.mock('@/server/services/user');
vi.mock('@/libs/redis', async (importOriginal) => {
  const actual = await importOriginal<typeof RedisModule>();
  return {
    ...actual,
    initializeRedisWithPrefix: vi.fn().mockResolvedValue({}),
  };
});

describe('userRouter', () => {
  const mockUserId = 'test-user-id';
  const mockCtx = {
    userId: mockUserId,
  };
  const createCommercialConfig = (platformHostedModels = false) => ({
    commercial: { enabled: platformHostedModels },
    lobeHubCloudIntegration: { enabled: false },
    nativeBilling: { enabled: false },
    platformHostedModels: { enabled: platformHostedModels },
  });

  const flushAfterTasks = async () => {
    await Promise.all(mockAfterTasks.splice(0));
  };

  beforeEach(() => {
    mockAfterTasks.length = 0;
    process.env.AUTH_SECRET = 'test-phone-verification-secret';
    vi.clearAllMocks();
    vi.mocked(getReferralStatus).mockResolvedValue(undefined);
    vi.mocked(getSubscriptionPlan).mockResolvedValue(Plans.Free);
    vi.mocked(onUserActivityForBusiness).mockResolvedValue(undefined);
    phoneVerificationMocks.sendCode.mockResolvedValue({
      cooldownSeconds: 60,
      maskedPhone: '+86138****0000',
    });
    phoneVerificationMocks.verifyCode.mockResolvedValue({
      normalizedPhoneNumber: '+8613800000000',
    });
    vi.mocked(getServerGlobalConfig).mockResolvedValue({
      aiProvider: {},
      commercial: createCommercialConfig(false),
    } as any);
  });

  describe('getUserRegistrationDuration', () => {
    it('should return registration duration', async () => {
      const mockDuration = { duration: 100, createdAt: '2023-01-01', updatedAt: '2023-01-02' };
      vi.mocked(UserModel).mockImplementation(
        () =>
          ({
            getUserRegistrationDuration: vi.fn().mockResolvedValue(mockDuration),
          }) as any,
      );

      const result = await userRouter.createCaller({ ...mockCtx }).getUserRegistrationDuration();

      expect(result).toEqual(mockDuration);
      expect(UserModel).toHaveBeenCalledWith(serverDB, mockUserId);
    });
  });

  describe('getUserSSOProviders', () => {
    it('should return SSO providers', async () => {
      const mockProviders = [
        {
          provider: 'google',
          providerAccountId: '123',
          userId: 'user-1',
          type: 'oauth',
        },
      ];
      vi.mocked(UserModel).mockImplementation(
        () =>
          ({
            getUserSSOProviders: vi.fn().mockResolvedValue(mockProviders),
          }) as any,
      );

      const result = await userRouter.createCaller({ ...mockCtx }).getUserSSOProviders();

      expect(result).toEqual(mockProviders);
      expect(UserModel).toHaveBeenCalledWith(serverDB, mockUserId);
    });
  });

  describe('getUserState', () => {
    it('should return user state', async () => {
      const mockState = {
        isOnboarded: true,
        preference: { telemetry: true },
        phone: '+8613800000000',
        phoneNumberVerified: true,
        settings: {},
        userId: mockUserId,
      };

      vi.mocked(UserModel).mockImplementation(
        () =>
          ({
            advanceLastActiveAt: vi.fn().mockResolvedValue(undefined),
            getUserState: vi.fn().mockResolvedValue(mockState),
            updateUser: vi.fn().mockResolvedValue({ rowCount: 1 }),
          }) as any,
      );

      vi.mocked(MessageModel).mockImplementation(
        () =>
          ({
            countUpTo: vi.fn().mockResolvedValue(5),
          }) as any,
      );

      vi.mocked(SessionModel).mockImplementation(
        () =>
          ({
            hasMoreThanN: vi.fn().mockResolvedValue(true),
          }) as any,
      );

      const result = await userRouter.createCaller({ ...mockCtx }).getUserState();

      expect(result).toMatchObject({
        isOnboard: true,
        preference: { telemetry: true },
        settings: {},
        hasConversation: true,
        phone: '+8613800000000',
        phoneNumberVerified: true,
        canEnablePWAGuide: true,
        canEnableTrace: true,
        userId: mockUserId,
      });
    });

    it('should invoke the user activity hook after winning the lastActiveAt update', async () => {
      const createdAt = new Date('2026-01-01T00:00:00.000Z');
      const previousLastActiveAt = new Date('2026-03-01T00:00:00.000Z');
      const advanceLastActiveAt = vi.fn().mockResolvedValue({
        previousLastActiveAt,
        userCreatedAt: createdAt,
      });
      const mockState = {
        isOnboarded: true,
        preference: {},
        settings: {},
        userId: mockUserId,
      };

      vi.mocked(UserModel).mockImplementation(
        () =>
          ({
            advanceLastActiveAt,
            getUserState: vi.fn().mockResolvedValue(mockState),
          }) as any,
      );
      vi.mocked(MessageModel).mockImplementation(
        () =>
          ({
            countUpTo: vi.fn().mockResolvedValue(0),
          }) as any,
      );
      vi.mocked(SessionModel).mockImplementation(
        () =>
          ({
            hasMoreThanN: vi.fn().mockResolvedValue(false),
          }) as any,
      );

      await userRouter.createCaller({ ...mockCtx }).getUserState();
      await flushAfterTasks();

      expect(advanceLastActiveAt).toHaveBeenCalledWith(expect.any(Date));
      expect(onUserActivityForBusiness).toHaveBeenCalledWith({
        currentTime: expect.any(Date),
        previousLastActiveAt,
        userCreatedAt: createdAt,
        userId: mockUserId,
      });
    });

    it('should skip the user activity hook when a concurrent request already updated lastActiveAt', async () => {
      const advanceLastActiveAt = vi.fn().mockResolvedValue(undefined);
      const mockState = {
        isOnboarded: true,
        preference: {},
        settings: {},
        userId: mockUserId,
      };

      vi.mocked(UserModel).mockImplementation(
        () =>
          ({
            advanceLastActiveAt,
            getUserState: vi.fn().mockResolvedValue(mockState),
          }) as any,
      );
      vi.mocked(MessageModel).mockImplementation(
        () =>
          ({
            countUpTo: vi.fn().mockResolvedValue(0),
          }) as any,
      );
      vi.mocked(SessionModel).mockImplementation(
        () =>
          ({
            hasMoreThanN: vi.fn().mockResolvedValue(false),
          }) as any,
      );

      await userRouter.createCaller({ ...mockCtx }).getUserState();
      await flushAfterTasks();

      expect(advanceLastActiveAt).toHaveBeenCalledWith(expect.any(Date));
      expect(onUserActivityForBusiness).not.toHaveBeenCalled();
    });
  });

  describe('makeUserOnboarded', () => {
    it('should update user onboarded status', async () => {
      vi.mocked(UserModel).mockImplementation(
        () =>
          ({
            updateUser: vi.fn().mockResolvedValue({ rowCount: 1 }),
          }) as any,
      );

      await userRouter.createCaller({ ...mockCtx }).makeUserOnboarded();

      expect(UserModel).toHaveBeenCalledWith(serverDB, mockUserId);
    });
  });

  describe('phone trial verification', () => {
    it('should fail closed when phone verification secret is missing', async () => {
      const keyVaultSecret = process.env.KEY_VAULTS_SECRET;
      const authSecret = process.env.AUTH_SECRET;
      delete process.env.KEY_VAULTS_SECRET;
      delete process.env.AUTH_SECRET;

      try {
        await expect(
          userRouter.createCaller({ ...mockCtx }).sendPhoneVerificationCode('+8613800000000'),
        ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
        expect(phoneVerificationMocks.sendCode).not.toHaveBeenCalled();
      } finally {
        if (keyVaultSecret === undefined) delete process.env.KEY_VAULTS_SECRET;
        else process.env.KEY_VAULTS_SECRET = keyVaultSecret;
        if (authSecret === undefined) delete process.env.AUTH_SECRET;
        else process.env.AUTH_SECRET = authSecret;
      }
    });

    it('should send phone verification code without updating user or granting trial credits', async () => {
      const updateUser = vi.fn();
      const onBusinessUserPhoneVerifiedSpy = vi.spyOn(businessUser, 'onBusinessUserPhoneVerified');
      vi.mocked(UserModel).mockImplementation(() => ({ updateUser }) as never);

      const result = await userRouter
        .createCaller({ ...mockCtx })
        .sendPhoneVerificationCode('+8613800000000');

      expect(phoneVerificationMocks.sendCode).toHaveBeenCalledWith('+8613800000000');
      expect(updateUser).not.toHaveBeenCalled();
      expect(onBusinessUserPhoneVerifiedSpy).not.toHaveBeenCalled();
      expect(result).toEqual({ cooldownSeconds: 60, maskedPhone: '+86138****0000' });
    });

    it('should not update user or grant trial credits when code verification fails', async () => {
      phoneVerificationMocks.verifyCode.mockRejectedValueOnce(
        new TRPCError({ code: 'BAD_REQUEST', message: 'PHONE_CODE_INVALID' }),
      );
      const updateUser = vi.fn();
      const onBusinessUserPhoneVerifiedSpy = vi.spyOn(businessUser, 'onBusinessUserPhoneVerified');
      vi.mocked(UserModel).mockImplementation(() => ({ updateUser }) as never);

      await expect(
        userRouter
          .createCaller({ ...mockCtx })
          .verifyPhoneForTrial({ code: '000000', phoneNumber: '+8613800000000' }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

      expect(updateUser).not.toHaveBeenCalled();
      expect(onBusinessUserPhoneVerifiedSpy).not.toHaveBeenCalled();
    });

    it('should update phone verification and grant trial credits after code verification succeeds', async () => {
      const updateUser = vi.fn().mockResolvedValue({ rowCount: 1 });
      const onBusinessUserPhoneVerifiedSpy = vi
        .spyOn(businessUser, 'onBusinessUserPhoneVerified')
        .mockResolvedValue({ granted: true });
      vi.mocked(UserModel).mockImplementation(() => ({ updateUser }) as never);

      const result = await userRouter
        .createCaller({ ...mockCtx })
        .verifyPhoneForTrial({ code: '123456', phoneNumber: '+86 138 0000 0000' });

      expect(phoneVerificationMocks.verifyCode).toHaveBeenCalledWith({
        code: '123456',
        phoneNumber: '+86 138 0000 0000',
      });
      expect(updateUser).toHaveBeenCalledWith({
        phone: '+8613800000000',
        phoneNumberVerified: true,
      });
      expect(onBusinessUserPhoneVerifiedSpy).toHaveBeenCalledWith({
        db: serverDB,
        phoneNumber: '+8613800000000',
        userId: mockUserId,
      });
      expect(result).toMatchObject({
        phone: '+8613800000000',
        phoneNumberVerified: true,
      });
    });

    it('should return conflict without granting trial credits when phone is already bound', async () => {
      const updateUser = vi.fn().mockRejectedValue({
        cause: {
          code: '23505',
          constraint: 'users_phone_unique',
        },
      });
      const onBusinessUserPhoneVerifiedSpy = vi.spyOn(businessUser, 'onBusinessUserPhoneVerified');
      vi.mocked(UserModel).mockImplementation(() => ({ updateUser }) as never);

      await expect(
        userRouter
          .createCaller({ ...mockCtx })
          .verifyPhoneForTrial({ code: '123456', phoneNumber: '+86 138 0000 0000' }),
      ).rejects.toMatchObject({
        code: 'CONFLICT',
        message: 'PHONE_ALREADY_BOUND',
      });

      expect(phoneVerificationMocks.verifyCode).toHaveBeenCalledWith({
        code: '123456',
        phoneNumber: '+86 138 0000 0000',
      });
      expect(updateUser).toHaveBeenCalledWith({
        phone: '+8613800000000',
        phoneNumberVerified: true,
      });
      expect(onBusinessUserPhoneVerifiedSpy).not.toHaveBeenCalled();
    });

    it('should return conflict when duplicate phone error uses constraint_name', async () => {
      const updateUser = vi.fn().mockRejectedValue({
        cause: {
          cause: {
            code: '23505',
            constraint_name: 'users_phone_unique',
          },
        },
      });
      const onBusinessUserPhoneVerifiedSpy = vi.spyOn(businessUser, 'onBusinessUserPhoneVerified');
      vi.mocked(UserModel).mockImplementation(() => ({ updateUser }) as never);

      await expect(
        userRouter
          .createCaller({ ...mockCtx })
          .verifyPhoneForTrial({ code: '123456', phoneNumber: '+86 138 0000 0000' }),
      ).rejects.toMatchObject({
        code: 'CONFLICT',
        message: 'PHONE_ALREADY_BOUND',
      });

      expect(onBusinessUserPhoneVerifiedSpy).not.toHaveBeenCalled();
    });
  });

  describe('updateSettings', () => {
    it('should update settings with encrypted key vaults', async () => {
      const mockSettings = {
        keyVaults: { openai: { key: 'test-key' } },
        general: { language: 'en-US' },
      };

      const mockEncryptedVaults = 'encrypted-data';
      const mockGateKeeper = {
        encrypt: vi.fn().mockResolvedValue(mockEncryptedVaults),
      };

      vi.mocked(KeyVaultsGateKeeper.initWithEnvKey).mockResolvedValue(mockGateKeeper as any);
      vi.mocked(UserModel).mockImplementation(
        () =>
          ({
            updateSetting: vi.fn().mockResolvedValue({ rowCount: 1 }),
          }) as any,
      );

      await userRouter.createCaller({ ...mockCtx }).updateSettings(mockSettings);

      expect(mockGateKeeper.encrypt).toHaveBeenCalledWith(JSON.stringify(mockSettings.keyVaults));
    });

    it('rejects key vault updates when platform hosted models are enabled', async () => {
      vi.mocked(getServerGlobalConfig).mockResolvedValue({
        aiProvider: {},
        commercial: createCommercialConfig(true),
      } as any);
      const updateSetting = vi.fn().mockResolvedValue({ rowCount: 1 });
      vi.mocked(UserModel).mockImplementation(
        () =>
          ({
            updateSetting,
          }) as any,
      );

      await expect(
        userRouter.createCaller({ ...mockCtx }).updateSettings({
          keyVaults: { openai: { key: 'test-key' } },
        }),
      ).rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: 'USER_PROVIDER_SETTINGS_DISABLED',
      });

      expect(KeyVaultsGateKeeper.initWithEnvKey).not.toHaveBeenCalled();
      expect(updateSetting).not.toHaveBeenCalled();
    });

    it('should update settings without key vaults', async () => {
      const mockSettings = {
        general: { language: 'en-US' },
      };
      const updateSetting = vi.fn().mockResolvedValue({ rowCount: 1 });

      vi.mocked(UserModel).mockImplementation(
        () =>
          ({
            updateSetting,
          }) as any,
      );

      await userRouter.createCaller({ ...mockCtx }).updateSettings(mockSettings);

      expect(UserModel).toHaveBeenCalledWith(serverDB, mockUserId);
      expect(updateSetting).toHaveBeenCalledWith({
        general: { language: 'en-US' },
      });
      expect(updateSetting).toHaveBeenCalledWith(
        expect.not.objectContaining({
          keyVaults: expect.anything(),
        }),
      );
    });

    it('allows non-key-vault settings updates in platform model only mode without touching keyVaults', async () => {
      vi.mocked(getServerGlobalConfig).mockResolvedValue({
        aiProvider: {},
        commercial: createCommercialConfig(true),
      } as any);
      const updateSetting = vi.fn().mockResolvedValue({ rowCount: 1 });
      vi.mocked(UserModel).mockImplementation(
        () =>
          ({
            updateSetting,
          }) as any,
      );

      await userRouter.createCaller({ ...mockCtx }).updateSettings({
        general: { language: 'en-US' },
      });

      expect(updateSetting).toHaveBeenCalledWith({
        general: { language: 'en-US' },
      });
      expect(updateSetting).toHaveBeenCalledWith(
        expect.not.objectContaining({
          keyVaults: expect.anything(),
        }),
      );
    });

    it('should allow legacy system agent model-only fields', async () => {
      const updateSetting = vi.fn().mockResolvedValue({ rowCount: 1 });

      vi.mocked(UserModel).mockImplementation(
        () =>
          ({
            updateSetting,
          }) as any,
      );

      await userRouter.createCaller({ ...mockCtx }).updateSettings({
        systemAgent: {
          queryRewrite: { model: 'ag/gemini-3.1-pro-high' },
          topic: { model: 'ag/gemini-3.1-pro-high' },
        },
      });

      expect(updateSetting).toHaveBeenCalledWith(
        expect.objectContaining({
          systemAgent: {
            queryRewrite: { model: 'ag/gemini-3.1-pro-high' },
            topic: { model: 'ag/gemini-3.1-pro-high' },
          },
        }),
      );
    });

    it('should allow legacy scalar system agent fields', async () => {
      const updateSetting = vi.fn().mockResolvedValue({ rowCount: 1 });

      vi.mocked(UserModel).mockImplementation(
        () =>
          ({
            updateSetting,
          }) as any,
      );

      await userRouter.createCaller({ ...mockCtx }).updateSettings({
        systemAgent: {
          enableAutoReply: true,
          replyMessage: 'Custom auto reply',
        },
      });

      expect(updateSetting).toHaveBeenCalledWith(
        expect.objectContaining({
          systemAgent: {
            enableAutoReply: true,
            replyMessage: 'Custom auto reply',
          },
        }),
      );
    });
  });
});
