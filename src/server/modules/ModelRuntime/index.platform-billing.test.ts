// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { initModelRuntimeFromDB } from './index';

const {
  AiProviderModel,
  getAiProviderById,
  getBusinessModelRuntimeHooks,
  getUserKeyVaults,
  llmConfig,
  initializeWithProvider,
  mergeModelRuntimeHooks,
  runtimeState,
} = vi.hoisted(() => ({
  AiProviderModel: vi.fn().mockImplementation(() => ({
    getAiProviderById: vi.fn(),
  })),
  getAiProviderById: vi.fn(),
  getBusinessModelRuntimeHooks: vi.fn(),
  getUserKeyVaults: vi.fn(),
  llmConfig: {
    OPENAI_API_KEY: 'platform-openai-key',
  } as Record<string, string | undefined>,
  initializeWithProvider: vi.fn(),
  mergeModelRuntimeHooks: vi.fn((businessHooks, tracingHooks) => ({
    businessHooks,
    tracingHooks,
  })),
  runtimeState: {
    nativeBillingEnabled: false,
    platformHostedModelsEnabled: false,
  },
}));

vi.mock('@lobechat/model-runtime', () => ({
  mergeModelRuntimeHooks,
  ModelRuntime: {
    initializeWithProvider,
  },
}));

vi.mock('@lobechat/model-runtime/vertexai', () => ({
  LobeVertexAI: {
    initFromVertexAI: vi.fn(),
  },
}));

vi.mock('@/business/server/model-runtime', () => ({
  getBusinessModelRuntimeHooks,
}));

vi.mock('@/business/shared/commercialRuntime', () => ({
  commercialRuntime: {
    nativeBilling: {
      get enabled() {
        return runtimeState.nativeBillingEnabled;
      },
    },
    platformHostedModels: {
      get enabled() {
        return runtimeState.platformHostedModelsEnabled;
      },
    },
  },
}));

vi.mock('@/database/models/aiProvider', () => ({
  AiProviderModel,
}));

vi.mock('@/envs/llm', () => ({
  getLLMConfig: () => llmConfig,
}));

vi.mock('@/server/modules/KeyVaultsEncrypt', () => ({
  KeyVaultsGateKeeper: {
    getUserKeyVaults,
  },
}));

vi.mock('@/server/services/llmGenerationTracing/hook', () => ({
  createLLMGenerationTracingHook: vi.fn(() => ({ tracing: true })),
}));

describe('initModelRuntimeFromDB platform billing', () => {
  beforeEach(() => {
    getAiProviderById.mockReset();
    AiProviderModel.mockClear();
    AiProviderModel.mockImplementation(() => ({ getAiProviderById }));
    getBusinessModelRuntimeHooks.mockReset();
    getUserKeyVaults.mockReset();
    initializeWithProvider.mockReset();
    mergeModelRuntimeHooks.mockClear();
    for (const key of Object.keys(llmConfig)) {
      delete llmConfig[key];
    }
    llmConfig.OPENAI_API_KEY = 'platform-openai-key';
    initializeWithProvider.mockReturnValue({ runtime: true });
    runtimeState.nativeBillingEnabled = false;
    runtimeState.platformHostedModelsEnabled = false;
  });

  it('uses global provider instance credentials and billing hooks when platform mode is enabled', async () => {
    runtimeState.nativeBillingEnabled = true;
    runtimeState.platformHostedModelsEnabled = true;
    const businessHooks = { billing: true };
    getBusinessModelRuntimeHooks.mockReturnValue(businessHooks);
    getAiProviderById.mockResolvedValue({
      enabled: true,
      keyVaults: { apiKey: 'relay-openai-key', baseURL: 'https://relay.example.com/v1' },
      settings: { sdkType: 'openai' },
    });

    const runtime = await initModelRuntimeFromDB({} as never, 'user-1', 'openai');

    expect(runtime).toEqual({ runtime: true });
    expect(AiProviderModel).not.toHaveBeenCalledWith(expect.anything(), 'user-1');
    expect(getAiProviderById).toHaveBeenCalledWith('openai', getUserKeyVaults);
    expect(getBusinessModelRuntimeHooks).toHaveBeenCalledWith('user-1', 'openai', {
      enforceGlobalProviderScope: true,
      requireTextPricing: true,
    });
    expect(mergeModelRuntimeHooks).toHaveBeenCalledWith(businessHooks, { tracing: true });
    expect(initializeWithProvider).toHaveBeenCalledWith(
      'openai',
      { apiKey: 'relay-openai-key', baseURL: 'https://relay.example.com/v1', userId: 'user-1' },
      { businessHooks, tracingHooks: { tracing: true } },
    );
  });

  it('installs platform scope hooks when platform mode is enabled without native billing', async () => {
    runtimeState.nativeBillingEnabled = false;
    runtimeState.platformHostedModelsEnabled = true;
    const businessHooks = { billing: false, scopeGuard: true };
    getBusinessModelRuntimeHooks.mockReturnValue(businessHooks);
    getAiProviderById.mockResolvedValue({
      enabled: true,
      keyVaults: { apiKey: 'relay-openai-key', baseURL: 'https://relay.example.com/v1' },
      settings: { sdkType: 'openai' },
    });

    await initModelRuntimeFromDB({} as never, 'user-1', 'openai');

    expect(getBusinessModelRuntimeHooks).toHaveBeenCalledWith('user-1', 'openai', {
      enforceGlobalProviderScope: true,
      requireTextPricing: false,
    });
    expect(mergeModelRuntimeHooks).toHaveBeenCalledWith(businessHooks, { tracing: true });
    expect(initializeWithProvider).toHaveBeenCalledWith(
      'openai',
      { apiKey: 'relay-openai-key', baseURL: 'https://relay.example.com/v1', userId: 'user-1' },
      { businessHooks, tracingHooks: { tracing: true } },
    );
  });

  it('resolves custom platform provider instances with sdkType instead of hard-coded newapi', async () => {
    runtimeState.platformHostedModelsEnabled = true;
    getAiProviderById.mockResolvedValue({
      enabled: true,
      keyVaults: { apiKey: 'anthropic-relay-key', baseURL: 'https://claude-relay.example.com' },
      settings: { sdkType: 'anthropic' },
    });

    const runtime = await initModelRuntimeFromDB({} as never, 'user-1', 'newapi-claude-relay');

    expect(runtime).toEqual({ runtime: true });
    expect(getBusinessModelRuntimeHooks).toHaveBeenCalledWith('user-1', 'newapi-claude-relay', {
      enforceGlobalProviderScope: true,
      requireTextPricing: false,
    });
    expect(initializeWithProvider).toHaveBeenCalledWith(
      'anthropic',
      {
        apiKey: 'anthropic-relay-key',
        baseURL: 'https://claude-relay.example.com',
        userId: 'user-1',
      },
      expect.any(Object),
    );
  });

  it('fails closed when global provider config is missing', async () => {
    runtimeState.nativeBillingEnabled = true;
    runtimeState.platformHostedModelsEnabled = true;
    getAiProviderById.mockResolvedValue(undefined);

    await expect(
      initModelRuntimeFromDB({} as never, 'user-1', 'custom-openai'),
    ).rejects.toMatchObject({
      code: 'PLATFORM_PROVIDER_DISABLED',
    });
    expect(getAiProviderById).toHaveBeenCalledWith('custom-openai', getUserKeyVaults);
  });

  it('fails closed when global provider credentials are missing', async () => {
    runtimeState.nativeBillingEnabled = true;
    runtimeState.platformHostedModelsEnabled = true;
    getAiProviderById.mockResolvedValue({ enabled: true, keyVaults: {}, settings: { sdkType: 'openai' } });

    await expect(initModelRuntimeFromDB({} as never, 'user-1', 'anthropic')).rejects.toMatchObject({
      code: 'PLATFORM_MODEL_CREDENTIAL_MISSING',
    });
    expect(initializeWithProvider).not.toHaveBeenCalled();
  });

  it('rejects OpenAI-compatible baseURL-only global provider credentials before runtime init', async () => {
    runtimeState.nativeBillingEnabled = true;
    runtimeState.platformHostedModelsEnabled = true;
    getAiProviderById.mockResolvedValue({
      enabled: true,
      keyVaults: { baseURL: 'https://relay.example.com/v1' },
      settings: { sdkType: 'openai' },
    });

    await expect(initModelRuntimeFromDB({} as never, 'user-1', 'openai')).rejects.toMatchObject({
      code: 'PLATFORM_MODEL_CREDENTIAL_MISSING',
    });
    expect(initializeWithProvider).not.toHaveBeenCalled();
  });

  it('keeps the user provider config path when platform billing is disabled', async () => {
    getAiProviderById.mockResolvedValue({
      keyVaults: { apiKey: 'user-openai-key', baseURL: 'https://user.example.com/v1' },
      settings: {},
    });

    await initModelRuntimeFromDB({} as never, 'user-1', 'openai');

    expect(getAiProviderById).toHaveBeenCalledWith('openai', getUserKeyVaults);
    expect(getBusinessModelRuntimeHooks).not.toHaveBeenCalled();
    expect(initializeWithProvider).toHaveBeenCalledWith(
      'openai',
      { apiKey: 'user-openai-key', baseURL: 'https://user.example.com/v1', userId: 'user-1' },
      expect.any(Object),
    );
  });
});
