import type { LobeDefaultAiModelListItem } from 'model-bank';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const loadBusinessModels = vi.hoisted(() => vi.fn());

vi.mock('@lobechat/business-model-bank/model-config', () => ({
  loadModels: loadBusinessModels,
}));

import { loadModels } from './loadModels';

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
    vi.unstubAllEnvs();
  });

  it('keeps all business model-bank models when platform billing is disabled', async () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_PLATFORM_BILLING', '0');

    await expect(loadModels()).resolves.toEqual(models);
  });

  it('keeps only platform hosted providers when platform billing is enabled', async () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_PLATFORM_BILLING', '1');

    const result = await loadModels();

    expect(result.map((model) => model.providerId)).toEqual([
      'openai',
      'anthropic',
      'deepseek',
      'lobehub',
    ]);
  });
});
