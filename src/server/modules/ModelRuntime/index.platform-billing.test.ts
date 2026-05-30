// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getAiProviderById,
  getBusinessModelRuntimeHooks,
  getUserKeyVaults,
  llmConfig,
  initializeWithProvider,
  mergeModelRuntimeHooks,
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

import { initModelRuntimeFromDB } from './index';

describe('initModelRuntimeFromDB platform billing', () => {
  const originalPlatformBilling = process.env.NEXT_PUBLIC_ENABLE_PLATFORM_BILLING;

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
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_ENABLE_PLATFORM_BILLING = originalPlatformBilling;
  });

  it('uses platform environment credentials without reading user keyVaults when enabled', async () => {
    process.env.NEXT_PUBLIC_ENABLE_PLATFORM_BILLING = '1';

    const runtime = await initModelRuntimeFromDB({} as never, 'user-1', 'openai');

    expect(runtime).toEqual({ runtime: true });
    expect(getAiProviderById).not.toHaveBeenCalled();
    expect(getUserKeyVaults).not.toHaveBeenCalled();
    expect(initializeWithProvider).toHaveBeenCalledWith(
      'openai',
      { apiKey: 'platform-openai-key', userId: 'user-1' },
      expect.any(Object),
    );
  });

  it('blocks custom providers when platform billing is enabled', async () => {
    process.env.NEXT_PUBLIC_ENABLE_PLATFORM_BILLING = '1';

    await expect(initModelRuntimeFromDB({} as never, 'user-1', 'custom-openai')).rejects.toMatchObject({
      code: 'PLATFORM_MODEL_ONLY',
    });
    expect(getAiProviderById).not.toHaveBeenCalled();
  });

  it('blocks hosted providers without their own platform credential', async () => {
    process.env.NEXT_PUBLIC_ENABLE_PLATFORM_BILLING = '1';

    await expect(initModelRuntimeFromDB({} as never, 'user-1', 'anthropic')).rejects.toMatchObject({
      code: 'PLATFORM_MODEL_CREDENTIAL_MISSING',
    });
    expect(initializeWithProvider).not.toHaveBeenCalled();
    expect(getAiProviderById).not.toHaveBeenCalled();
  });

  it('keeps the user provider config path when platform billing is disabled', async () => {
    process.env.NEXT_PUBLIC_ENABLE_PLATFORM_BILLING = '0';
    getAiProviderById.mockResolvedValue({
      keyVaults: { apiKey: 'user-openai-key', baseURL: 'https://user.example.com/v1' },
      settings: {},
    });

    await initModelRuntimeFromDB({} as never, 'user-1', 'openai');

    expect(getAiProviderById).toHaveBeenCalledWith('openai', getUserKeyVaults);
    expect(initializeWithProvider).toHaveBeenCalledWith(
      'openai',
      { apiKey: 'user-openai-key', baseURL: 'https://user.example.com/v1', userId: 'user-1' },
      expect.any(Object),
    );
  });
});
