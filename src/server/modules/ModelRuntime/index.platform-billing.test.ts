// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { initModelRuntimeFromDB } from './index';

const {
  getAiProviderById,
  getBusinessModelRuntimeHooks,
  getUserKeyVaults,
  llmConfig,
  initializeWithProvider,
  mergeModelRuntimeHooks,
  runtimeState,
} = vi.hoisted(() => ({
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
  AiProviderModel: vi.fn().mockImplementation(() => ({
    getAiProviderById,
  })),
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

  it('uses platform environment credentials without reading user keyVaults when enabled', async () => {
    runtimeState.nativeBillingEnabled = true;
    runtimeState.platformHostedModelsEnabled = true;
    const businessHooks = { billing: true };
    getBusinessModelRuntimeHooks.mockReturnValue(businessHooks);

    const runtime = await initModelRuntimeFromDB({} as never, 'user-1', 'openai');

    expect(runtime).toEqual({ runtime: true });
    expect(getAiProviderById).not.toHaveBeenCalled();
    expect(getUserKeyVaults).not.toHaveBeenCalled();
    expect(getBusinessModelRuntimeHooks).toHaveBeenCalledWith('user-1', 'openai');
    expect(mergeModelRuntimeHooks).toHaveBeenCalledWith(businessHooks, { tracing: true });
    expect(initializeWithProvider).toHaveBeenCalledWith(
      'openai',
      { apiKey: 'platform-openai-key', userId: 'user-1' },
      { businessHooks, tracingHooks: { tracing: true } },
    );
  });

  it('uses platform environment credentials without billing hooks when only platform hosted models are enabled', async () => {
    runtimeState.platformHostedModelsEnabled = true;

    const runtime = await initModelRuntimeFromDB({} as never, 'user-1', 'openai');

    expect(runtime).toEqual({ runtime: true });
    expect(getAiProviderById).not.toHaveBeenCalled();
    expect(getUserKeyVaults).not.toHaveBeenCalled();
    expect(getBusinessModelRuntimeHooks).not.toHaveBeenCalled();
    expect(initializeWithProvider).toHaveBeenCalledWith(
      'openai',
      { apiKey: 'platform-openai-key', userId: 'user-1' },
      expect.any(Object),
    );
  });

  it('blocks custom providers when platform billing is enabled', async () => {
    runtimeState.nativeBillingEnabled = true;
    runtimeState.platformHostedModelsEnabled = true;

    await expect(
      initModelRuntimeFromDB({} as never, 'user-1', 'custom-openai'),
    ).rejects.toMatchObject({
      code: 'PLATFORM_MODEL_ONLY',
    });
    expect(getAiProviderById).not.toHaveBeenCalled();
  });

  it('blocks hosted providers without their own platform credential', async () => {
    runtimeState.nativeBillingEnabled = true;
    runtimeState.platformHostedModelsEnabled = true;

    await expect(initModelRuntimeFromDB({} as never, 'user-1', 'anthropic')).rejects.toMatchObject({
      code: 'PLATFORM_MODEL_CREDENTIAL_MISSING',
    });
    expect(initializeWithProvider).not.toHaveBeenCalled();
    expect(getAiProviderById).not.toHaveBeenCalled();
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
