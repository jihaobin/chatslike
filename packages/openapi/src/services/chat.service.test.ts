import type { LobeChatDatabase } from '@/database/type';
import { describe, expect, it, vi } from 'vitest';

const {
  chatRuntime,
  initModelRuntimeFromDB,
  initModelRuntimeWithUserPayload,
  keyVaultsGateKeeper,
  runtimeState,
} = vi.hoisted(() => ({
  chatRuntime: {
    chat: vi.fn(),
  },
  initModelRuntimeFromDB: vi.fn(),
  initModelRuntimeWithUserPayload: vi.fn(),
  keyVaultsGateKeeper: {
    decrypt: vi.fn(),
  },
  runtimeState: {
    platformHostedModelsEnabled: false,
  },
}));

vi.mock('@/business/server/model-runtime', () => ({
  getBusinessModelRuntimeHooks: vi.fn(() => ({ billing: true })),
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

vi.mock('@/const/settings', () => ({
  DEFAULT_AGENT_CHAT_CONFIG: {},
  DEFAULT_SYSTEM_AGENT_CONFIG: {
    translation: { model: 'gpt-4.1', provider: 'openai' },
  },
}));

vi.mock('@/database/models/user', () => ({
  UserModel: class {},
}));

vi.mock('@/database/schemas', () => ({
  agents: {},
  agentsToSessions: {},
  aiModels: {},
}));

vi.mock('@/server/services/systemAgent/modelConfig', () => ({
  resolveSystemAgentModelConfig: vi.fn(() => ({ model: 'gpt-4.1', provider: 'openai' })),
}));

vi.mock('@/server/modules/KeyVaultsEncrypt', () => ({
  KeyVaultsGateKeeper: {
    initWithEnvKey: vi.fn(async () => keyVaultsGateKeeper),
  },
}));

vi.mock('@/server/modules/ModelRuntime', () => ({
  initModelRuntimeFromDB,
  initModelRuntimeWithUserPayload,
}));

vi.mock('../common/base.service', () => ({
  BaseService: class {
    protected db: LobeChatDatabase;
    protected userId: string;

    constructor(db: LobeChatDatabase, userId: string | null) {
      this.db = db;
      this.userId = userId || '';
    }

    protected createAuthorizationError(message: string) {
      const error = new Error(message);
      error.name = 'AuthorizationError';
      return error;
    }

    protected createCommonError(message: string) {
      const error = new Error(message);
      error.name = 'BusinessError';
      return error;
    }

    protected log() {}

    protected async resolveOperationPermission() {
      return { isPermitted: true };
    }
  },
}));

import { ChatService } from './chat.service';

describe('ChatService.chat', () => {
  it('uses DB initialized platform runtime without user API key lookup in platform-hosted mode', async () => {
    runtimeState.platformHostedModelsEnabled = true;
    chatRuntime.chat.mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: 'hello', role: 'assistant' } }],
          usage: { total_tokens: 3 },
        }),
        { headers: { 'content-type': 'application/json' } },
      ),
    );
    initModelRuntimeFromDB.mockResolvedValue(chatRuntime);
    keyVaultsGateKeeper.decrypt.mockResolvedValue({ plaintext: '{"apiKey":"user-key"}' });
    const findMany = vi.fn(async () => [{ keyVaults: 'encrypted-user-key' }]);
    const db = {
      query: {
        aiProviders: { findMany },
      },
    } as unknown as LobeChatDatabase;
    const service = new ChatService(db, 'user-1');

    const result = await service.chat({
      messages: [{ content: 'hi', role: 'user' }],
      model: 'gpt-4.1',
      provider: 'openai',
    });

    expect(initModelRuntimeFromDB).toHaveBeenCalledWith(db, 'user-1', 'openai');
    expect(initModelRuntimeWithUserPayload).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
    expect(result).toMatchObject({ content: 'hello', model: 'gpt-4.1', provider: 'openai' });
  });
});
