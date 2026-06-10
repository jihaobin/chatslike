import { beforeEach, describe, expect, it, vi } from 'vitest';

import { commercialRuntime } from '@/business/shared/commercialRuntime';
import { RbacModel } from '@/database/models/rbac';
import { KeyVaultsGateKeeper } from '@/server/modules/KeyVaultsEncrypt';

import { ProviderService } from '../provider.service';

const { decrypt, encrypt, runtimeState } = vi.hoisted(() => ({
  decrypt: vi.fn(),
  encrypt: vi.fn(),
  runtimeState: {
    platformHostedModelsEnabled: false,
  },
}));

vi.mock('@/business/shared/commercialRuntime', () => ({
  commercialRuntime: {
    platformHostedModels: {
      get enabled() {
        return runtimeState.platformHostedModelsEnabled;
      },
    },
  },
}));

vi.mock('@/database/models/rbac', () => ({
  RbacModel: vi.fn().mockImplementation(() => ({
    hasAnyPermission: vi.fn().mockResolvedValue(true),
  })),
}));

vi.mock('@/server/modules/KeyVaultsEncrypt', () => ({
  KeyVaultsGateKeeper: {
    initWithEnvKey: vi.fn().mockResolvedValue({
      decrypt,
      encrypt,
    }),
  },
}));

const createProviderRecord = () => ({
  checkModel: 'gpt-4o-mini',
  config: {},
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  description: null,
  enabled: true,
  fetchOnClient: null,
  id: 'custom-openai',
  keyVaults: 'encrypted-key-vaults',
  logo: null,
  name: 'Custom OpenAI',
  settings: {},
  sort: null,
  source: 'custom',
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  userId: 'user-1',
});

const createMockDb = () => {
  const providerRecord = createProviderRecord();
  const updateChain = {
    returning: vi.fn().mockResolvedValue([providerRecord]),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
  };

  return {
    delete: vi.fn(),
    insert: vi.fn(),
    query: {
      aiProviders: {
        findFirst: vi.fn().mockResolvedValue(providerRecord),
        findMany: vi.fn().mockResolvedValue([providerRecord]),
      },
      users: {
        findFirst: vi.fn().mockResolvedValue({ id: 'user-1', role: null }),
      },
    },
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 1 }]),
      }),
    }),
    transaction: vi.fn(),
    update: vi.fn().mockReturnValue(updateChain),
  };
};

describe('ProviderService platform model only', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeState.platformHostedModelsEnabled = false;
    decrypt.mockResolvedValue({
      plaintext: JSON.stringify({ apiKey: 'user-openai-key' }),
      wasAuthentic: true,
    });
    encrypt.mockResolvedValue('encrypted-key-vaults');
  });

  it('does not return decrypted keyVaults when platform hosted models are enabled', async () => {
    runtimeState.platformHostedModelsEnabled = true;
    const db = createMockDb();
    const service = new ProviderService(db as never, 'user-1');

    const detail = await service.getProviderDetail({ id: 'custom-openai' });
    const list = await service.getProviders({});

    expect(detail).not.toHaveProperty('keyVaults');
    expect(list.providers[0]).not.toHaveProperty('keyVaults');
    expect(KeyVaultsGateKeeper.initWithEnvKey).not.toHaveBeenCalled();
    expect(decrypt).not.toHaveBeenCalled();
  });

  it.each([
    ['createProvider', () => ({ id: 'custom-openai', keyVaults: { apiKey: 'user-key' } })],
    ['updateProvider', () => ({ id: 'custom-openai', keyVaults: { apiKey: 'user-key' } })],
    ['deleteProvider', () => ({ id: 'custom-openai' })],
  ] as const)(
    'rejects %s when platform hosted models are enabled',
    async (method, inputFactory) => {
      runtimeState.platformHostedModelsEnabled = true;
      const db = createMockDb();
      const service = new ProviderService(db as never, 'user-1') as any;

      await expect(service[method](inputFactory())).rejects.toMatchObject({
        message: 'USER_PROVIDER_SETTINGS_DISABLED',
        name: 'BusinessError',
      });

      expect(encrypt).not.toHaveBeenCalled();
      expect(db.insert).not.toHaveBeenCalled();
      expect(db.update).not.toHaveBeenCalled();
      expect(db.transaction).not.toHaveBeenCalled();
    },
  );

  it('lets super admin update provider settings when platform hosted models are enabled', async () => {
    runtimeState.platformHostedModelsEnabled = true;
    const db = createMockDb();
    db.query.users.findFirst.mockResolvedValue({ id: 'super-admin-user', role: 'super-admin' });
    const service = new ProviderService(db as never, 'super-admin-user');

    await service.updateProvider({ id: 'custom-openai', name: 'Custom OpenAI Updated' });

    expect(db.update).toHaveBeenCalled();
  });

  it('keeps keyVault behavior outside platform hosted model mode', async () => {
    const db = createMockDb();
    const service = new ProviderService(db as never, 'user-1');

    const detail = await service.getProviderDetail({ id: 'custom-openai' });

    expect(detail.keyVaults).toEqual({ apiKey: 'user-openai-key' });
    expect(decrypt).toHaveBeenCalledWith('encrypted-key-vaults');
    expect(RbacModel).toHaveBeenCalledWith(db, 'user-1');
    expect(commercialRuntime.platformHostedModels.enabled).toBe(false);
  });
});
