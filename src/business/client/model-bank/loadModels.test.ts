import type { LobeDefaultAiModelListItem } from 'model-bank';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadModels } from './loadModels';

const loadBusinessModels = vi.hoisted(() => vi.fn());
const state = vi.hoisted(() => ({
  commercialRuntime: {
    platformHostedModels: {
      enabled: true,
    },
  },
}));

vi.mock('@lobechat/business-model-bank/model-config', () => ({
  loadModels: loadBusinessModels,
}));

vi.mock('@/business/shared/commercialRuntime', () => ({
  commercialRuntime: state.commercialRuntime,
}));

const models = [
  {
    abilities: {},
    id: 'gpt-4o',
    providerId: 'openai',
    type: 'chat',
  },
  {
    abilities: {},
    id: 'claude-sonnet-4',
    providerId: 'anthropic',
    type: 'chat',
  },
  {
    abilities: {},
    id: 'deepseek-chat',
    providerId: 'deepseek',
    type: 'chat',
  },
  {
    abilities: {},
    id: 'lobehub-chat',
    providerId: 'lobehub',
    type: 'chat',
  },
  {
    abilities: {},
    id: 'custom-model',
    providerId: 'custom-openai',
    type: 'chat',
  },
] satisfies LobeDefaultAiModelListItem[];

describe('business loadModels', () => {
  beforeEach(() => {
    loadBusinessModels.mockResolvedValue(models);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('keeps all business model-bank models when platform hosted models are disabled', async () => {
    state.commercialRuntime.platformHostedModels.enabled = false;

    await expect(loadModels()).resolves.toEqual(models);
  });

  it('keeps only platform hosted providers when platform hosted models are enabled', async () => {
    state.commercialRuntime.platformHostedModels.enabled = true;

    const result = await loadModels();

    expect(result.map((model) => model.providerId)).toEqual([
      'openai',
      'anthropic',
      'deepseek',
      'lobehub',
    ]);
  });
});
