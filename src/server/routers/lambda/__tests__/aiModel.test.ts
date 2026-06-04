import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  GLOBAL_PROVIDER_SCOPE_FORBIDDEN,
  USER_PROVIDER_SETTINGS_DISABLED,
} from '@/business/server/globalProviderScope/permissions';
import { getServerDB } from '@/database/core/db-adaptor';
import { AiModelModel } from '@/database/models/aiModel';
import { AiInfraRepos } from '@/database/repositories/aiInfra';
import { getServerGlobalConfig } from '@/server/globalConfig';

import { aiModelRouter } from '../aiModel';

vi.mock('@/database/core/db-adaptor');
vi.mock('@/database/models/aiModel');
vi.mock('@/database/models/user');
vi.mock('@/database/repositories/aiInfra');
vi.mock('@/server/globalConfig', () => ({
  getServerGlobalConfig: vi.fn().mockReturnValue({
    aiProvider: {},
    commercial: { platformHostedModels: { enabled: false } },
  }),
}));
vi.mock('@/server/modules/KeyVaultsEncrypt', () => ({
  KeyVaultsGateKeeper: {
    initWithEnvKey: vi.fn().mockResolvedValue({
      decrypt: vi.fn(),
      encrypt: vi.fn(),
    }),
  },
}));

describe('aiModelRouter', () => {
  const mockCtx = {
    userId: 'test-user',
  };
  const mockDb = {
    insert: vi.fn(),
    select: vi.fn(),
  };

  const mockSentinelUserInsert = () => {
    const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn().mockReturnValue({ onConflictDoNothing });
    return { onConflictDoNothing, query: { values }, values };
  };

  const mockRoleLookup = (role?: string) => {
    const query = {
      from: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(role ? [{ role }] : []),
      where: vi.fn().mockReturnThis(),
    };
    mockDb.select.mockReturnValue(query);
  };

  const mockAiModel = (implementation: Partial<AiModelModel>) => {
    Object.assign(vi.mocked(AiModelModel).prototype, implementation);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerGlobalConfig).mockReturnValue({
      aiProvider: {},
      commercial: { platformHostedModels: { enabled: false } },
    } as never);
    vi.mocked(getServerDB).mockResolvedValue(mockDb as never);
    mockRoleLookup('user');
  });

  it('should create ai model', async () => {
    const mockCreate = vi.fn().mockResolvedValue({ id: 'model-1' });
    mockAiModel({ create: mockCreate });

    const caller = aiModelRouter.createCaller(mockCtx);

    const result = await caller.createAiModel({
      id: 'test-model',
      providerId: 'test-provider',
    });

    expect(result).toBe('model-1');
    expect(mockCreate).toHaveBeenCalledWith({
      id: 'test-model',
      providerId: 'test-provider',
    });
  });

  it('should get ai model by id', async () => {
    const mockModel = {
      id: 'model-1',
      name: 'Test Model',
    };
    const mockFindById = vi.fn().mockResolvedValue(mockModel);
    mockAiModel({ findById: mockFindById });

    const caller = aiModelRouter.createCaller(mockCtx);

    const result = await caller.getAiModelById({ id: 'model-1' });

    expect(result).toEqual(mockModel);
    expect(mockFindById).toHaveBeenCalledWith('model-1');
  });

  it('rejects explicit global model detail reads for ordinary users', async () => {
    const mockFindById = vi.fn();
    mockAiModel({ findById: mockFindById });

    const caller = aiModelRouter.createCaller(mockCtx);

    await expect(caller.getAiModelById({ id: 'model-1', scope: 'global' })).rejects.toMatchObject({
      message: GLOBAL_PROVIDER_SCOPE_FORBIDDEN,
    });
    expect(mockFindById).not.toHaveBeenCalled();
  });

  it('should get ai provider model list', async () => {
    const mockModelList = [
      { id: 'model-1', name: 'Model 1' },
      { id: 'model-2', name: 'Model 2' },
    ];
    const mockGetList = vi.fn().mockResolvedValue(mockModelList);
    vi.mocked(AiInfraRepos).prototype.getAiProviderModelList = mockGetList;

    const caller = aiModelRouter.createCaller(mockCtx);

    const result = await caller.getAiProviderModelList({ id: 'provider-1' });

    expect(result).toEqual(mockModelList);
    expect(mockGetList).toHaveBeenCalledWith('provider-1', {
      enabled: undefined,
      limit: undefined,
      offset: undefined,
      type: undefined,
    });
  });

  it('rejects explicit global provider model list reads for ordinary users', async () => {
    const mockGetList = vi.fn();
    vi.mocked(AiInfraRepos).prototype.getAiProviderModelList = mockGetList;

    const caller = aiModelRouter.createCaller(mockCtx);

    await expect(
      caller.getAiProviderModelList({ id: 'provider-1', scope: 'global' }),
    ).rejects.toMatchObject({
      message: GLOBAL_PROVIDER_SCOPE_FORBIDDEN,
    });
    expect(mockGetList).not.toHaveBeenCalled();
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('should remove ai model', async () => {
    const mockDelete = vi.fn().mockResolvedValue(true);
    mockAiModel({ delete: mockDelete });

    const caller = aiModelRouter.createCaller(mockCtx);

    await caller.removeAiModel({ id: 'model-1', providerId: 'provider-1' });

    expect(mockDelete).toHaveBeenCalledWith('model-1', 'provider-1');
  });

  it('should update ai model', async () => {
    const mockUpdate = vi.fn().mockResolvedValue(true);
    mockAiModel({ update: mockUpdate });

    const caller = aiModelRouter.createCaller(mockCtx);

    await caller.updateAiModel({
      id: 'model-1',
      providerId: 'provider-1',
      value: { displayName: 'Updated Model' },
    });

    expect(mockUpdate).toHaveBeenCalledWith('model-1', 'provider-1', {
      displayName: 'Updated Model',
    });
  });

  it('should toggle model enabled status', async () => {
    const mockToggle = vi.fn().mockResolvedValue(true);
    mockAiModel({ toggleModelEnabled: mockToggle });

    const caller = aiModelRouter.createCaller(mockCtx);

    await caller.toggleModelEnabled({
      enabled: true,
      id: 'model-1',
      providerId: 'provider-1',
      type: 'embedding',
    });

    expect(mockToggle).toHaveBeenCalledWith({
      enabled: true,
      id: 'model-1',
      providerId: 'provider-1',
      type: 'embedding',
    });
  });

  it('should batch toggle ai models', async () => {
    const mockBatchToggle = vi.fn().mockResolvedValue(true);
    mockAiModel({ batchToggleAiModels: mockBatchToggle });

    const caller = aiModelRouter.createCaller(mockCtx);

    await caller.batchToggleAiModels({
      enabled: true,
      id: 'provider-1',
      models: ['model-1', 'model-2'],
    });

    expect(mockBatchToggle).toHaveBeenCalledWith('provider-1', ['model-1', 'model-2'], true);
  });

  it('should batch update ai models', async () => {
    const mockBatchUpdate = vi.fn().mockResolvedValue([]);
    mockAiModel({ batchUpdateAiModels: mockBatchUpdate });

    const caller = aiModelRouter.createCaller(mockCtx);

    await caller.batchUpdateAiModels({
      id: 'provider-1',
      models: [
        { enabled: true, id: 'model-1', type: 'chat' },
        { enabled: true, id: 'model-2', type: 'chat' },
      ],
    });

    expect(mockBatchUpdate).toHaveBeenCalledWith('provider-1', [
      { enabled: true, id: 'model-1', type: 'chat' },
      { enabled: true, id: 'model-2', type: 'chat' },
    ]);
  });

  it('should clear models by provider', async () => {
    const mockClear = vi.fn().mockResolvedValue(true);
    mockAiModel({ clearModelsByProvider: mockClear });

    const caller = aiModelRouter.createCaller(mockCtx);

    await caller.clearModelsByProvider({ providerId: 'provider-1' });

    expect(mockClear).toHaveBeenCalledWith('provider-1');
  });

  it('should clear remote models', async () => {
    const mockClearRemote = vi.fn().mockResolvedValue(true);
    mockAiModel({ clearRemoteModels: mockClearRemote });

    const caller = aiModelRouter.createCaller(mockCtx);

    await caller.clearRemoteModels({ providerId: 'provider-1' });

    expect(mockClearRemote).toHaveBeenCalledWith('provider-1');
  });

  it.each([
    [
      'createAiModel',
      (caller: ReturnType<typeof aiModelRouter.createCaller>) =>
        caller.createAiModel({ id: 'model-1', providerId: 'provider-1' }),
    ],
    [
      'updateAiModel',
      (caller: ReturnType<typeof aiModelRouter.createCaller>) =>
        caller.updateAiModel({
          id: 'model-1',
          providerId: 'provider-1',
          value: { displayName: 'Updated Model' },
        }),
    ],
    [
      'toggleModelEnabled',
      (caller: ReturnType<typeof aiModelRouter.createCaller>) =>
        caller.toggleModelEnabled({ enabled: true, id: 'model-1', providerId: 'provider-1' }),
    ],
    [
      'removeAiModel',
      (caller: ReturnType<typeof aiModelRouter.createCaller>) =>
        caller.removeAiModel({ id: 'model-1', providerId: 'provider-1' }),
    ],
    [
      'batchUpdateAiModels',
      (caller: ReturnType<typeof aiModelRouter.createCaller>) =>
        caller.batchUpdateAiModels({
          id: 'provider-1',
          models: [{ enabled: true, id: 'model-1', type: 'chat' }],
        }),
    ],
    [
      'batchToggleAiModels',
      (caller: ReturnType<typeof aiModelRouter.createCaller>) =>
        caller.batchToggleAiModels({ enabled: true, id: 'provider-1', models: ['model-1'] }),
    ],
    [
      'updateAiModelOrder',
      (caller: ReturnType<typeof aiModelRouter.createCaller>) =>
        caller.updateAiModelOrder({ providerId: 'provider-1', sortMap: [{ id: 'model-1', sort: 1 }] }),
    ],
  ])('rejects %s for ordinary users in platform model only mode', async (_, callProcedure) => {
    vi.mocked(getServerGlobalConfig).mockReturnValue({
      aiProvider: {},
      commercial: { platformHostedModels: { enabled: true } },
    } as never);
    const mockUpdate = vi.fn();
    mockAiModel({
      batchToggleAiModels: mockUpdate,
      batchUpdateAiModels: mockUpdate,
      create: mockUpdate,
      delete: mockUpdate,
      toggleModelEnabled: mockUpdate,
      update: mockUpdate,
      updateModelsOrder: mockUpdate,
    });

    const caller = aiModelRouter.createCaller(mockCtx);

    await expect(callProcedure(caller)).rejects.toMatchObject({
      message: USER_PROVIDER_SETTINGS_DISABLED,
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('lets super admin update global model config', async () => {
    vi.mocked(getServerGlobalConfig).mockReturnValue({
      aiProvider: {},
      commercial: { platformHostedModels: { enabled: true } },
    } as never);
    mockRoleLookup('super-admin');
    const sentinelInsert = mockSentinelUserInsert();
    mockDb.insert.mockReturnValueOnce(sentinelInsert.query);
    const mockUpdate = vi.fn().mockResolvedValue(true);
    mockAiModel({ update: mockUpdate });

    const caller = aiModelRouter.createCaller(mockCtx);

    await caller.updateAiModel({
      id: 'gpt-4o',
      providerId: 'newapi-openai-relay',
      scope: 'global',
      value: { displayName: 'GPT-4o' },
    });

    expect(mockUpdate).toHaveBeenCalledWith('gpt-4o', 'newapi-openai-relay', {
      displayName: 'GPT-4o',
    });
    expect(sentinelInsert.onConflictDoNothing).toHaveBeenCalled();
  });
});
