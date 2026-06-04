import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AsyncTaskStatus, AsyncTaskType } from '@/types/asyncTask';

import { imageRouter } from './index';

// Use vi.hoisted for variables used in vi.mock factory
const {
  mockServerDB,
  mockGetKeyFromFullUrl,
  mockGetFullFileUrl,
  mockAsyncTaskModelUpdate,
  mockChargeBeforeGenerate,
  mockCreateAsyncCaller,
  mockAssertGlobalProviderModelAvailable,
  mockLoadModels,
  mockResolveBusinessModelMapping,
  nativeBillingEnabled,
  platformHostedModelsEnabled,
} = vi.hoisted(() => ({
  mockServerDB: {
    transaction: vi.fn(),
  },
  mockGetKeyFromFullUrl: vi.fn(),
  mockGetFullFileUrl: vi.fn(),
  mockAsyncTaskModelUpdate: vi.fn(),
  mockChargeBeforeGenerate: vi.fn(),
  mockCreateAsyncCaller: vi.fn(),
  mockAssertGlobalProviderModelAvailable: vi.fn(),
  mockLoadModels: vi.fn(),
  mockResolveBusinessModelMapping: vi.fn(),
  nativeBillingEnabled: { value: true },
  platformHostedModelsEnabled: { value: false },
}));

// Mock debug
vi.mock('debug', () => ({
  default: () => () => {},
}));

// Mock database adaptor
vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn(async () => mockServerDB),
}));

// Mock FileService
vi.mock('@/server/services/file', () => ({
  FileService: vi.fn(() => ({
    getKeyFromFullUrl: mockGetKeyFromFullUrl,
    getFullFileUrl: mockGetFullFileUrl,
  })),
}));

// Mock AsyncTaskModel
vi.mock('@/database/models/asyncTask', () => ({
  AsyncTaskModel: vi.fn(() => ({
    update: mockAsyncTaskModelUpdate,
  })),
}));

// Mock chargeBeforeGenerate
vi.mock('@/business/server/image-generation/chargeBeforeGenerate', () => ({
  chargeBeforeGenerate: (params: any) => mockChargeBeforeGenerate(params),
}));

vi.mock('@/business/shared/commercialRuntime', () => ({
  commercialRuntime: {
    nativeBilling: {
      get enabled() {
        return nativeBillingEnabled.value;
      },
    },
    platformHostedModels: {
      get enabled() {
        return platformHostedModelsEnabled.value;
      },
    },
  },
}));

vi.mock('@/business/server/globalProviderScope/runtimeGuard', () => ({
  assertGlobalProviderModelAvailable: mockAssertGlobalProviderModelAvailable,
}));

vi.mock('@lobechat/business-model-runtime', async (importOriginal) => ({
  ...((await importOriginal()) as typeof import('@lobechat/business-model-runtime')),
  resolveBusinessModelMapping: (...args: [string, string]) =>
    mockResolveBusinessModelMapping(...args),
}));

vi.mock('@lobechat/business-model-bank/model-config', () => ({
  loadModels: mockLoadModels,
}));

// Mock async caller
vi.mock('@/server/routers/async/caller', () => ({
  createAsyncCaller: mockCreateAsyncCaller,
}));

// Mock drizzle-orm
vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args) => args),
  eq: vi.fn((a, b) => ({ a, b })),
}));

// Mock database schemas
vi.mock('@/database/schemas', () => ({
  asyncTasks: { id: 'asyncTasks.id', userId: 'asyncTasks.userId' },
  generationBatches: { id: 'generationBatches.id' },
  generations: { id: 'generations.id', userId: 'generations.userId' },
}));

// Mock seed generator
vi.mock('@/utils/number', () => ({
  generateUniqueSeeds: vi.fn((count: number) => Array.from({ length: count }, (_, i) => 1000 + i)),
}));

describe('imageRouter', () => {
  const mockUserId = 'test-user-id';
  const mockAsyncCallerCreateImage = vi.fn();

  const createMockCtx = (overrides = {}) => ({
    userId: mockUserId,
    ...overrides,
  });

  const createDefaultInput = (overrides = {}) => ({
    generationTopicId: 'topic-1',
    imageNum: 2,
    model: 'stable-diffusion',
    params: {
      prompt: 'a beautiful sunset',
      width: 512,
      height: 512,
    },
    provider: 'test-provider',
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    nativeBillingEnabled.value = true;
    platformHostedModelsEnabled.value = false;

    // Default mock implementations
    mockResolveBusinessModelMapping.mockImplementation(
      async (_provider: string, model: string) => ({
        resolvedModelId: model,
      }),
    );
    mockChargeBeforeGenerate.mockResolvedValue(undefined);
    mockAssertGlobalProviderModelAvailable.mockResolvedValue(undefined);
    mockGetKeyFromFullUrl.mockResolvedValue(null);
    mockGetFullFileUrl.mockResolvedValue(null);
    mockLoadModels.mockResolvedValue([
      {
        abilities: {},
        enabled: true,
        id: 'gpt-image-1',
        providerId: 'lobehub',
        type: 'image',
      },
    ]);

    // Setup default transaction mock
    const mockBatch = {
      id: 'batch-1',
      generationTopicId: 'topic-1',
      model: 'stable-diffusion',
      provider: 'test-provider',
      config: {},
      userId: mockUserId,
    };

    const mockGenerations = [
      { id: 'gen-1', generationBatchId: 'batch-1', seed: 1000, userId: mockUserId },
      { id: 'gen-2', generationBatchId: 'batch-1', seed: 1001, userId: mockUserId },
    ];

    const mockAsyncTasks = [
      { id: 'task-1', status: AsyncTaskStatus.Pending, type: AsyncTaskType.ImageGeneration },
      { id: 'task-2', status: AsyncTaskStatus.Pending, type: AsyncTaskType.ImageGeneration },
    ];

    let insertCallCount = 0;
    mockServerDB.transaction.mockImplementation(async (callback) => {
      insertCallCount = 0;
      const tx = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockImplementation(() => {
              insertCallCount++;
              if (insertCallCount === 1) return [mockBatch];
              if (insertCallCount === 2) return mockGenerations;
              // For async tasks, return one at a time
              const taskIndex = insertCallCount - 3;
              return [mockAsyncTasks[taskIndex] || mockAsyncTasks[0]];
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      };

      return callback(tx);
    });

    mockCreateAsyncCaller.mockResolvedValue({
      image: {
        createImage: mockAsyncCallerCreateImage,
      },
    });
  });

  describe('createImage', () => {
    it('should create image generation batch and generations successfully', async () => {
      const ctx = createMockCtx();
      const input = createDefaultInput();

      const caller = imageRouter.createCaller(ctx);
      const result = await caller.createImage(input);

      expect(result.success).toBe(true);
      expect(result.data.batch).toBeDefined();
      expect(result.data.batch.id).toBe('batch-1');
      expect(result.data.generations).toHaveLength(2);
      expect(mockServerDB.transaction).toHaveBeenCalled();
    });

    it('should validate mapped model id before rejecting deprecated lobehub image models', async () => {
      mockResolveBusinessModelMapping.mockResolvedValue({
        requestedModelId: 'onboarding-image',
        resolvedModelId: 'gpt-image-1',
      });

      const ctx = createMockCtx();
      const input = createDefaultInput({
        model: 'onboarding-image',
        provider: 'lobehub',
      });

      const caller = imageRouter.createCaller(ctx);
      const result = await caller.createImage(input);

      expect(result.success).toBe(true);
      expect(mockResolveBusinessModelMapping).toHaveBeenCalledWith('lobehub', 'onboarding-image');
      expect(mockCreateAsyncCaller).toHaveBeenCalledWith({ userId: mockUserId });
    });

    it('should convert imageUrls to S3 keys for database storage', async () => {
      mockGetKeyFromFullUrl
        .mockResolvedValueOnce('files/image1.jpg')
        .mockResolvedValueOnce('files/image2.jpg');

      const ctx = createMockCtx();
      const input = createDefaultInput({
        params: {
          prompt: 'test prompt',
          imageUrls: [
            'https://s3.amazonaws.com/bucket/files/image1.jpg',
            'https://s3.amazonaws.com/bucket/files/image2.jpg',
          ],
        },
      });

      const caller = imageRouter.createCaller(ctx);
      await caller.createImage(input);

      expect(mockGetKeyFromFullUrl).toHaveBeenCalledTimes(2);
      expect(mockGetKeyFromFullUrl).toHaveBeenCalledWith(
        'https://s3.amazonaws.com/bucket/files/image1.jpg',
      );
      expect(mockGetKeyFromFullUrl).toHaveBeenCalledWith(
        'https://s3.amazonaws.com/bucket/files/image2.jpg',
      );
    });

    it('should convert single imageUrl to S3 key for database storage', async () => {
      mockGetKeyFromFullUrl.mockResolvedValue('files/single-image.jpg');

      const ctx = createMockCtx();
      const input = createDefaultInput({
        params: {
          prompt: 'test prompt',
          imageUrl: 'https://s3.amazonaws.com/bucket/files/single-image.jpg',
        },
      });

      const caller = imageRouter.createCaller(ctx);
      await caller.createImage(input);

      expect(mockGetKeyFromFullUrl).toHaveBeenCalledWith(
        'https://s3.amazonaws.com/bucket/files/single-image.jpg',
      );
    });

    it('should handle failed URL to key conversion gracefully for imageUrls', async () => {
      mockGetKeyFromFullUrl.mockResolvedValue(null);

      const ctx = createMockCtx();
      const input = createDefaultInput({
        params: {
          prompt: 'test prompt',
          imageUrls: ['https://example.com/image.jpg'],
        },
      });

      const caller = imageRouter.createCaller(ctx);
      const result = await caller.createImage(input);

      // Should still succeed, just with empty imageUrls in config
      expect(result.success).toBe(true);
    });

    it('should throw error when imageUrls conversion fails and URLs remain', async () => {
      mockGetKeyFromFullUrl.mockRejectedValue(new Error('Conversion failed'));

      const ctx = createMockCtx();
      const input = createDefaultInput({
        params: {
          prompt: 'test prompt',
          imageUrls: ['https://example.com/image.jpg'],
        },
      });

      const caller = imageRouter.createCaller(ctx);

      // When conversion fails, the original URL is kept but validateNoUrlsInConfig
      // will detect it and throw an error to prevent storing URLs in database
      await expect(caller.createImage(input)).rejects.toThrow(
        'Invalid configuration: Found full URL instead of key',
      );
    });

    it('should throw error when single imageUrl conversion fails and URL remains', async () => {
      mockGetKeyFromFullUrl.mockRejectedValue(new Error('Conversion failed'));

      const ctx = createMockCtx();
      const input = createDefaultInput({
        params: {
          prompt: 'test prompt',
          imageUrl: 'https://example.com/image.jpg',
        },
      });

      const caller = imageRouter.createCaller(ctx);

      // When conversion fails, the original URL is kept but validateNoUrlsInConfig
      // will detect it and throw an error to prevent storing URLs in database
      await expect(caller.createImage(input)).rejects.toThrow(
        'Invalid configuration: Found full URL instead of key',
      );
    });

    it('should return charge error batch when chargeBeforeGenerate returns one', async () => {
      const chargeResult = {
        success: true as const,
        data: {
          batch: { id: 'charged-batch' },
          generations: [{ id: 'charged-gen' }],
        },
      };
      mockChargeBeforeGenerate.mockResolvedValue({ errorBatch: chargeResult });

      const ctx = createMockCtx();
      const input = createDefaultInput();

      const caller = imageRouter.createCaller(ctx);
      const result = await caller.createImage(input);

      expect(result).toEqual(chargeResult);
      // Should not proceed with database transaction
      expect(mockServerDB.transaction).not.toHaveBeenCalled();
    });

    it('should store billing reservation metadata in generation batch config', async () => {
      mockChargeBeforeGenerate.mockResolvedValue({
        billing: {
          estimatedCredits: 80_000,
          operationId: 'image:test-user-id:topic-1:test-provider:stable-diffusion:hash',
          reservationId: 'reservation-image-1',
        },
      });

      const ctx = createMockCtx();
      const input = createDefaultInput();

      const caller = imageRouter.createCaller(ctx);
      await caller.createImage(input);

      const transactionCallback = mockServerDB.transaction.mock.calls[0][0];
      const insert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockReturnValue([{ id: 'batch-billing' }]),
        }),
      });

      await transactionCallback({
        insert,
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      });

      expect(insert().values).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            billing: expect.objectContaining({
              estimatedCredits: 80_000,
              reservationId: 'reservation-image-1',
            }),
          }),
        }),
      );
    });

    it('should call chargeBeforeGenerate with correct parameters', async () => {
      const ctx = createMockCtx();
      const input = createDefaultInput();

      const caller = imageRouter.createCaller(ctx);
      await caller.createImage(input);

      expect(mockChargeBeforeGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          generationTopicId: 'topic-1',
          imageNum: 2,
          model: 'stable-diffusion',
          provider: 'test-provider',
          userId: mockUserId,
        }),
      );
    });

    it('server-enforces global provider availability before creating platform-hosted images', async () => {
      platformHostedModelsEnabled.value = true;
      const ctx = createMockCtx();
      const input = createDefaultInput({ model: 'gpt-image-1', provider: 'newapi-openai-relay' });

      const caller = imageRouter.createCaller(ctx);
      await caller.createImage(input);

      expect(mockAssertGlobalProviderModelAvailable).toHaveBeenCalledWith({
        db: mockServerDB,
        modality: 'image',
        model: 'gpt-image-1',
        provider: 'newapi-openai-relay',
        requirePricing: true,
      });
    });

    it('should skip pre-charge and billing metadata when native billing is disabled', async () => {
      nativeBillingEnabled.value = false;
      mockChargeBeforeGenerate.mockResolvedValue({
        billing: {
          estimatedCredits: 80_000,
          operationId: 'image:test-user-id:topic-1:test-provider:stable-diffusion:hash',
          reservationId: 'reservation-image-1',
        },
      });

      const ctx = createMockCtx();
      const input = createDefaultInput();

      const caller = imageRouter.createCaller(ctx);
      await caller.createImage(input);

      expect(mockChargeBeforeGenerate).not.toHaveBeenCalled();

      const transactionCallback = mockServerDB.transaction.mock.calls[0][0];
      const insert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockReturnValue([{ id: 'batch-without-billing' }]),
        }),
      });

      await transactionCallback({
        insert,
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      });

      expect(insert().values).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.not.objectContaining({
            billing: expect.anything(),
          }),
        }),
      );
    });

    it('should strip forged billing metadata when native billing is disabled', async () => {
      nativeBillingEnabled.value = false;

      const ctx = createMockCtx();
      const input = createDefaultInput({
        params: {
          billing: {
            estimatedCredits: 1,
            operationId: 'forged-operation',
            reservationId: 'forged-reservation',
          },
          customOption: 'keep-me',
          height: 512,
          prompt: 'a beautiful sunset',
          width: 512,
        },
      });

      const caller = imageRouter.createCaller(ctx);
      await caller.createImage(input);

      expect(mockChargeBeforeGenerate).not.toHaveBeenCalled();

      const transactionCallback = mockServerDB.transaction.mock.calls[0][0];
      const insert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockReturnValue([{ id: 'batch-without-forged-billing' }]),
        }),
      });

      await transactionCallback({
        insert,
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      });

      expect(insert().values).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            customOption: 'keep-me',
          }),
        }),
      );
      expect(insert().values).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.not.objectContaining({
            billing: expect.anything(),
          }),
        }),
      );
    });

    it('should trigger async image generation tasks', async () => {
      const ctx = createMockCtx();
      const input = createDefaultInput();

      const caller = imageRouter.createCaller(ctx);
      await caller.createImage(input);

      expect(mockCreateAsyncCaller).toHaveBeenCalledWith({ userId: mockUserId });
    });

    it('should handle async caller creation failure', async () => {
      mockCreateAsyncCaller.mockRejectedValue(new Error('Caller creation failed'));

      const ctx = createMockCtx();
      const input = createDefaultInput();

      const caller = imageRouter.createCaller(ctx);
      const result = await caller.createImage(input);

      // Should still return success as the database records were created
      expect(result.success).toBe(true);
      // Should update async task status to error
      expect(mockAsyncTaskModelUpdate).toHaveBeenCalled();
    });

    it('should update all task statuses to error when async processing fails', async () => {
      mockCreateAsyncCaller.mockRejectedValue(new Error('Processing failed'));

      const ctx = createMockCtx();
      const input = createDefaultInput();

      const caller = imageRouter.createCaller(ctx);
      await caller.createImage(input);

      // Should update both tasks to error status
      expect(mockAsyncTaskModelUpdate).toHaveBeenCalledTimes(2);
      expect(mockAsyncTaskModelUpdate).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          status: AsyncTaskStatus.Error,
        }),
      );
    });

    it('should generate unique seeds when seed param is provided', async () => {
      const ctx = createMockCtx();
      const input = createDefaultInput({
        params: {
          prompt: 'test prompt',
          seed: 42,
        },
      });

      const caller = imageRouter.createCaller(ctx);
      await caller.createImage(input);

      expect(mockServerDB.transaction).toHaveBeenCalled();
    });

    it('should use null seeds when seed param is not provided', async () => {
      const ctx = createMockCtx();
      const input = createDefaultInput({
        params: {
          prompt: 'test prompt',
          // No seed param
        },
      });

      const caller = imageRouter.createCaller(ctx);
      await caller.createImage(input);

      expect(mockServerDB.transaction).toHaveBeenCalled();
    });

    it('should pass with valid key-based imageUrls', async () => {
      mockGetKeyFromFullUrl.mockResolvedValue('files/valid-key.jpg');

      const ctx = createMockCtx();
      const input = createDefaultInput({
        params: {
          prompt: 'test prompt',
          imageUrls: ['files/valid-key.jpg'],
        },
      });

      const caller = imageRouter.createCaller(ctx);
      const result = await caller.createImage(input);

      expect(result.success).toBe(true);
    });

    describe('development environment URL conversion', () => {
      beforeEach(() => {
        vi.stubEnv('NODE_ENV', 'development');
      });

      afterEach(() => {
        vi.unstubAllEnvs();
      });

      it('should convert single imageUrl to S3 URL in development mode', async () => {
        mockGetKeyFromFullUrl.mockResolvedValue('files/image-key.jpg');
        mockGetFullFileUrl.mockResolvedValue('https://s3.amazonaws.com/bucket/files/image-key.jpg');

        const ctx = createMockCtx();
        const input = createDefaultInput({
          params: {
            prompt: 'test prompt',
            imageUrl: 'http://localhost:3000/f/file-id',
          },
        });

        const caller = imageRouter.createCaller(ctx);
        const result = await caller.createImage(input);

        expect(result.success).toBe(true);
        expect(mockGetFullFileUrl).toHaveBeenCalledWith('files/image-key.jpg');
      });

      it('should convert multiple imageUrls to S3 URLs in development mode', async () => {
        mockGetKeyFromFullUrl
          .mockResolvedValueOnce('files/image1.jpg')
          .mockResolvedValueOnce('files/image2.jpg');
        mockGetFullFileUrl
          .mockResolvedValueOnce('https://s3.amazonaws.com/bucket/files/image1.jpg')
          .mockResolvedValueOnce('https://s3.amazonaws.com/bucket/files/image2.jpg');

        const ctx = createMockCtx();
        const input = createDefaultInput({
          params: {
            prompt: 'test prompt',
            imageUrls: ['http://localhost:3000/f/id1', 'http://localhost:3000/f/id2'],
          },
        });

        const caller = imageRouter.createCaller(ctx);
        const result = await caller.createImage(input);

        expect(result.success).toBe(true);
        expect(mockGetFullFileUrl).toHaveBeenCalledTimes(2);
        expect(mockGetFullFileUrl).toHaveBeenCalledWith('files/image1.jpg');
        expect(mockGetFullFileUrl).toHaveBeenCalledWith('files/image2.jpg');
      });

      it('should not convert URLs when getFullFileUrl returns null', async () => {
        mockGetKeyFromFullUrl.mockResolvedValue('files/image-key.jpg');
        mockGetFullFileUrl.mockResolvedValue(null);

        const ctx = createMockCtx();
        const input = createDefaultInput({
          params: {
            prompt: 'test prompt',
            imageUrl: 'http://localhost:3000/f/file-id',
          },
        });

        const caller = imageRouter.createCaller(ctx);
        const result = await caller.createImage(input);

        expect(result.success).toBe(true);
        expect(mockGetFullFileUrl).toHaveBeenCalled();
      });
    });
  });
});
