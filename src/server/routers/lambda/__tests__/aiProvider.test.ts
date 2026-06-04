// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  GLOBAL_PROVIDER_CONFIG_USER_ID,
} from '@/business/server/globalProviderScope/constants';
import {
  GLOBAL_PROVIDER_SCOPE_FORBIDDEN,
  USER_PROVIDER_SETTINGS_DISABLED,
} from '@/business/server/globalProviderScope/permissions';
import { getServerDB } from '@/database/core/db-adaptor';
import { AiProviderModel } from '@/database/models/aiProvider';
import { AiInfraRepos } from '@/database/repositories/aiInfra';
import { getServerGlobalConfig } from '@/server/globalConfig';
import { KeyVaultsGateKeeper } from '@/server/modules/KeyVaultsEncrypt';
import { initModelRuntimeFromDB } from '@/server/modules/ModelRuntime';
import { type AiProviderDetailItem, type AiProviderRuntimeState } from '@/types/aiProvider';

import { aiProviderRouter } from '../aiProvider';

vi.mock('@/server/globalConfig');
vi.mock('@/server/modules/KeyVaultsEncrypt');
vi.mock('@/database/core/db-adaptor');
vi.mock('@/database/repositories/aiInfra');
vi.mock('@/database/models/aiProvider');
vi.mock('@/database/models/user');
vi.mock('@/server/modules/ModelRuntime');

describe('aiProviderRouter', () => {
  const mockUserId = 'test-user-id';
  const mockProviderId = 'test-provider-id';
  const mockEncrypt = vi.fn();
  const mockDecrypt = vi.fn();
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

  const mockGateKeeper = {
    encrypt: mockEncrypt,
    decrypt: mockDecrypt,
  };

  const mockProviderDetail: AiProviderDetailItem = {
    id: mockProviderId,
    name: 'Test Provider',
    enabled: true,
    description: 'Test Description',
    source: 'custom',
    settings: {},
  };

  const mockRuntimeState: AiProviderRuntimeState = {
    enabledAiModels: [],
    enabledAiProviders: [],
    enabledChatAiProviders: [],
    enabledImageAiProviders: [],
    enabledVideoAiProviders: [],
    runtimeConfig: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getServerGlobalConfig).mockReturnValue({
      aiProvider: {},
      commercial: { platformHostedModels: { enabled: false } },
    } as never);

    vi.mocked(getServerDB).mockResolvedValue(mockDb as never);
    mockRoleLookup('user');
    vi.mocked(KeyVaultsGateKeeper.initWithEnvKey).mockResolvedValue(mockGateKeeper as never);
  });

  const createMockContext = () => ({
    userId: mockUserId,
  });

  describe('createAiProvider', () => {
    it('should create a new AI provider', async () => {
      const mockCreate = vi.fn().mockResolvedValue({ id: mockProviderId });
      vi.mocked(AiProviderModel).prototype.create = mockCreate;

      const caller = aiProviderRouter.createCaller(createMockContext());
      const result = await caller.createAiProvider({
        id: mockProviderId,
        name: 'Test Provider',
        source: 'custom',
      });

      expect(result).toBe(mockProviderId);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockProviderId,
          name: 'Test Provider',
        }),
        mockGateKeeper.encrypt,
      );
    });

    it('lets super admin create a global provider in platform model mode', async () => {
      vi.mocked(getServerGlobalConfig).mockReturnValue({
        aiProvider: {},
        commercial: { platformHostedModels: { enabled: true } },
      } as never);
      mockRoleLookup('super-admin');
      const sentinelInsert = mockSentinelUserInsert();
      mockDb.insert.mockReturnValueOnce(sentinelInsert.query);
      const mockCreate = vi.fn().mockResolvedValue({ id: 'newapi-openai-relay' });
      vi.mocked(AiProviderModel).prototype.create = mockCreate;

      const caller = aiProviderRouter.createCaller(createMockContext());
      const result = await caller.createAiProvider({
        id: 'newapi-openai-relay',
        name: 'OpenAI Relay',
        scope: 'global',
        source: 'custom',
      });

      expect(result).toBe('newapi-openai-relay');
      expect(AiProviderModel).toHaveBeenCalledWith(mockDb, GLOBAL_PROVIDER_CONFIG_USER_ID);
      expect(sentinelInsert.onConflictDoNothing).toHaveBeenCalled();
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'newapi-openai-relay', name: 'OpenAI Relay' }),
        mockGateKeeper.encrypt,
      );
    });
  });

  describe('checkProviderConnectivity', () => {
    it('preserves user scoped connectivity checks by default', async () => {
      const mockGetDetail = vi.fn().mockResolvedValue({ ...mockProviderDetail, checkModel: 'gpt-4o' });
      const chat = vi.fn().mockResolvedValue({ ok: true });
      vi.mocked(AiInfraRepos).prototype.getAiProviderDetail = mockGetDetail;
      vi.mocked(initModelRuntimeFromDB).mockResolvedValue({ chat } as never);

      const caller = aiProviderRouter.createCaller(createMockContext());

      await expect(caller.checkProviderConnectivity({ id: mockProviderId })).resolves.toEqual({
        model: 'gpt-4o',
        ok: true,
      });
      expect(initModelRuntimeFromDB).toHaveBeenCalledWith(mockDb, mockUserId, mockProviderId);
      expect(mockGetDetail).toHaveBeenCalledWith(mockProviderId, KeyVaultsGateKeeper.getUserKeyVaults);
    });

    it('rejects ordinary user explicit global connectivity checks before loading provider secrets', async () => {
      vi.mocked(getServerGlobalConfig).mockReturnValue({
        aiProvider: {},
        commercial: { platformHostedModels: { enabled: true } },
      } as never);
      mockRoleLookup('user');
      const mockGetDetail = vi.fn();
      vi.mocked(AiInfraRepos).prototype.getAiProviderDetail = mockGetDetail;

      const caller = aiProviderRouter.createCaller(createMockContext());

      await expect(
        caller.checkProviderConnectivity({ id: mockProviderId, scope: 'global' }),
      ).rejects.toMatchObject({ message: GLOBAL_PROVIDER_SCOPE_FORBIDDEN });
      expect(mockGetDetail).not.toHaveBeenCalled();
      expect(initModelRuntimeFromDB).not.toHaveBeenCalled();
    });
  });

  describe('getAiProviderById', () => {
    it('should get AI provider by id', async () => {
      const mockGetDetail = vi.fn().mockResolvedValue(mockProviderDetail);
      vi.mocked(AiInfraRepos).prototype.getAiProviderDetail = mockGetDetail;

      const caller = aiProviderRouter.createCaller(createMockContext());
      const result = await caller.getAiProviderById({ id: mockProviderId });

      expect(result).toEqual(mockProviderDetail);
      expect(mockGetDetail).toHaveBeenCalledWith(
        mockProviderId,
        KeyVaultsGateKeeper.getUserKeyVaults,
      );
    });

    it('sanitizes platform provider detail for ordinary users in platform model mode', async () => {
      vi.mocked(getServerGlobalConfig).mockReturnValue({
        aiProvider: {},
        commercial: { platformHostedModels: { enabled: true } },
      } as never);
      const mockGetDetail = vi.fn().mockResolvedValue({
        ...mockProviderDetail,
        keyVaults: { apiKey: 'secret-key' },
      });
      vi.mocked(AiInfraRepos).prototype.getAiProviderDetail = mockGetDetail;

      const caller = aiProviderRouter.createCaller(createMockContext());
      const result = await caller.getAiProviderById({ id: mockProviderId });

      expect(result).toEqual(expect.objectContaining({ id: mockProviderId }));
      expect(result?.keyVaults).toBeUndefined();
    });

    it('rejects ordinary user explicit global provider detail reads', async () => {
      vi.mocked(getServerGlobalConfig).mockReturnValue({
        aiProvider: {},
        commercial: { platformHostedModels: { enabled: true } },
      } as never);
      mockRoleLookup('user');
      const mockGetDetail = vi.fn();
      vi.mocked(AiInfraRepos).prototype.getAiProviderDetail = mockGetDetail;

      const caller = aiProviderRouter.createCaller(createMockContext());

      await expect(
        caller.getAiProviderById({ id: mockProviderId, scope: 'global' }),
      ).rejects.toMatchObject({ message: GLOBAL_PROVIDER_SCOPE_FORBIDDEN });
      expect(mockGetDetail).not.toHaveBeenCalled();
    });
  });

  describe('getAiProviderList', () => {
    it('should get AI provider list', async () => {
      const mockList = [mockProviderDetail];
      const mockGetList = vi.fn().mockResolvedValue(mockList);
      vi.mocked(AiInfraRepos).prototype.getAiProviderList = mockGetList;

      const caller = aiProviderRouter.createCaller(createMockContext());
      const result = await caller.getAiProviderList();

      expect(result).toEqual(mockList);
      expect(mockGetList).toHaveBeenCalled();
    });

    it('rejects ordinary user explicit global provider list reads', async () => {
      mockRoleLookup('user');
      const mockGetList = vi.fn();
      vi.mocked(AiInfraRepos).prototype.getAiProviderList = mockGetList;

      const caller = aiProviderRouter.createCaller(createMockContext());

      await expect(caller.getAiProviderList({ scope: 'global' })).rejects.toMatchObject({
        message: GLOBAL_PROVIDER_SCOPE_FORBIDDEN,
      });
      expect(mockGetList).not.toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });

  describe('getAiProviderRuntimeState', () => {
    it('should get AI provider runtime state', async () => {
      const mockGetState = vi.fn().mockResolvedValue(mockRuntimeState);
      vi.mocked(AiInfraRepos).prototype.getAiProviderRuntimeState = mockGetState;

      const caller = aiProviderRouter.createCaller(createMockContext());
      const result = await caller.getAiProviderRuntimeState({});

      expect(result).toEqual(mockRuntimeState);
      expect(mockGetState).toHaveBeenCalledWith(KeyVaultsGateKeeper.getUserKeyVaults);
    });

    it('sanitizes platform runtime key vaults for ordinary users in platform model mode', async () => {
      vi.mocked(getServerGlobalConfig).mockReturnValue({
        aiProvider: {},
        commercial: { platformHostedModels: { enabled: true } },
      } as never);
      const mockGetState = vi.fn().mockResolvedValue({
        ...mockRuntimeState,
        runtimeConfig: {
          'newapi-openai-relay': {
            config: {},
            keyVaults: { apiKey: 'secret-key' },
            settings: {},
          },
        },
      });
      vi.mocked(AiInfraRepos).prototype.getAiProviderRuntimeState = mockGetState;

      const caller = aiProviderRouter.createCaller(createMockContext());
      const result = await caller.getAiProviderRuntimeState({});

      expect(result.runtimeConfig['newapi-openai-relay']?.keyVaults).toEqual({});
    });

    it('rejects ordinary user explicit global runtime state reads', async () => {
      vi.mocked(getServerGlobalConfig).mockReturnValue({
        aiProvider: {},
        commercial: { platformHostedModels: { enabled: true } },
      } as never);
      mockRoleLookup('user');
      const mockGetState = vi.fn();
      vi.mocked(AiInfraRepos).prototype.getAiProviderRuntimeState = mockGetState;

      const caller = aiProviderRouter.createCaller(createMockContext());

      await expect(caller.getAiProviderRuntimeState({ scope: 'global' })).rejects.toMatchObject({
        message: GLOBAL_PROVIDER_SCOPE_FORBIDDEN,
      });
      expect(mockGetState).not.toHaveBeenCalled();
    });
  });

  describe('removeAiProvider', () => {
    it('should remove AI provider', async () => {
      const mockDelete = vi.fn();
      vi.mocked(AiProviderModel).prototype.delete = mockDelete;

      const caller = aiProviderRouter.createCaller(createMockContext());
      await caller.removeAiProvider({ id: mockProviderId });

      expect(mockDelete).toHaveBeenCalledWith(mockProviderId);
    });
  });

  describe('toggleProviderEnabled', () => {
    it('should toggle provider enabled state', async () => {
      const mockToggle = vi.fn();
      vi.mocked(AiProviderModel).prototype.toggleProviderEnabled = mockToggle;

      const caller = aiProviderRouter.createCaller(createMockContext());
      await caller.toggleProviderEnabled({
        id: mockProviderId,
        enabled: true,
      });

      expect(mockToggle).toHaveBeenCalledWith(mockProviderId, true);
    });
  });

  describe('updateAiProvider', () => {
    it('should update AI provider', async () => {
      const mockUpdate = vi.fn();
      vi.mocked(AiProviderModel).prototype.update = mockUpdate;

      const caller = aiProviderRouter.createCaller(createMockContext());
      await caller.updateAiProvider({
        id: mockProviderId,
        value: { name: 'Updated Provider' },
      });

      expect(mockUpdate).toHaveBeenCalledWith(mockProviderId, {
        name: 'Updated Provider',
      });
    });

    it('rejects ordinary user global provider writes', async () => {
      vi.mocked(getServerGlobalConfig).mockReturnValue({
        aiProvider: {},
        commercial: { platformHostedModels: { enabled: true } },
      } as never);
      mockRoleLookup('user');
      const mockUpdate = vi.fn();
      vi.mocked(AiProviderModel).prototype.update = mockUpdate;

      const caller = aiProviderRouter.createCaller(createMockContext());

      await expect(
        caller.updateAiProvider({
          id: mockProviderId,
          scope: 'global',
          value: { name: 'Updated Provider' },
        }),
      ).rejects.toMatchObject({ message: GLOBAL_PROVIDER_SCOPE_FORBIDDEN });
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('keeps rejecting ordinary user provider writes in platform model only mode', async () => {
      vi.mocked(getServerGlobalConfig).mockReturnValue({
        aiProvider: {},
        commercial: { platformHostedModels: { enabled: true } },
      } as never);
      const mockUpdate = vi.fn();
      vi.mocked(AiProviderModel).prototype.update = mockUpdate;

      const caller = aiProviderRouter.createCaller(createMockContext());

      await expect(
        caller.updateAiProvider({
          id: mockProviderId,
          value: { name: 'Updated Provider' },
        }),
      ).rejects.toMatchObject({ message: USER_PROVIDER_SETTINGS_DISABLED });
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe('updateAiProviderConfig', () => {
    it('should update AI provider config', async () => {
      const mockUpdateConfig = vi.fn();
      vi.mocked(AiProviderModel).prototype.updateConfig = mockUpdateConfig;

      const caller = aiProviderRouter.createCaller(createMockContext());
      await caller.updateAiProviderConfig({
        id: mockProviderId,
        value: { checkModel: 'gpt-4' },
      });

      expect(mockUpdateConfig).toHaveBeenCalledWith(
        mockProviderId,
        { checkModel: 'gpt-4' },
        mockGateKeeper.encrypt,
        KeyVaultsGateKeeper.getUserKeyVaults,
      );
    });
  });

  describe('updateAiProviderOrder', () => {
    it('should update AI provider order', async () => {
      const mockUpdateOrder = vi.fn();
      vi.mocked(AiProviderModel).prototype.updateOrder = mockUpdateOrder;

      const sortMap = [{ id: mockProviderId, sort: 1 }];
      const caller = aiProviderRouter.createCaller(createMockContext());
      await caller.updateAiProviderOrder({ sortMap });

      expect(mockUpdateOrder).toHaveBeenCalledWith(sortMap);
    });
  });
});
