import type { ExtendParamsValues } from 'model-bank';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as aiInfraStore from '@/store/aiInfra';
import * as aiModelSelectorsModule from '@/store/aiInfra/slices/aiModel/selectors';

import { resolveModelExtendParams } from './modelParamsResolver';

describe('resolveModelExtendParams', () => {
  const mockAiInfraStoreState = { someState: true };
  const createDefaultParams = (params: Partial<ExtendParamsValues> = {}): ExtendParamsValues => ({
    ...params,
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(aiInfraStore, 'getAiInfraStoreState').mockReturnValue(mockAiInfraStoreState as any);
  });

  describe('when model has no extend params', () => {
    beforeEach(() => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'isModelHasExtendParams').mockReturnValue(
        () => false,
      );
    });

    it('should return empty object when model has no extend params support', () => {
      const result = resolveModelExtendParams({
        model: 'gpt-4',
        provider: 'openai',
      });

      expect(result).toEqual({});
    });

    it('should return empty object even if defaultExtendParams has extended params configured', () => {
      const result = resolveModelExtendParams({
        model: 'basic-model',
        provider: 'provider',
      });

      expect(result).toEqual({});
    });
  });

  describe('when model has extend params but no modelExtendParams available', () => {
    beforeEach(() => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'isModelHasExtendParams').mockReturnValue(
        () => true,
      );
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelExtendParams').mockReturnValue(
        () => undefined,
      );
    });

    it('should return empty object when modelExtendParams is undefined', () => {
      const result = resolveModelExtendParams({
        model: 'gpt-4',
        provider: 'openai',
      });

      expect(result).toEqual({});
    });
  });

  describe('reasoning configuration', () => {
    describe('enableReasoning param', () => {
      beforeEach(() => {
        vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'isModelHasExtendParams').mockReturnValue(
          () => true,
        );
        vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelExtendParams').mockReturnValue(
          () => ['enableReasoning'],
        );
      });

      it('should set thinking to enabled with budget when enableReasoning is true', () => {
        vi.spyOn(
          aiModelSelectorsModule.aiModelSelectors,
          'modelDefaultExtendParams',
        ).mockReturnValue(() =>
          createDefaultParams({ enableReasoning: true, reasoningBudgetToken: 2048 }),
        );

        const result = resolveModelExtendParams({
          model: 'gpt-4',
          provider: 'openai',
        });

        expect(result.thinking).toEqual({
          budget_tokens: 2048,
          type: 'enabled',
        });
      });

      it('should use default budget token when not specified', () => {
        vi.spyOn(
          aiModelSelectorsModule.aiModelSelectors,
          'modelDefaultExtendParams',
        ).mockReturnValue(() => createDefaultParams({ enableReasoning: true }));

        const result = resolveModelExtendParams({
          model: 'gpt-4',
          provider: 'openai',
        });

        expect(result.thinking).toEqual({
          budget_tokens: 1024,
          type: 'enabled',
        });
      });

      it('should set thinking to disabled when enableReasoning is false', () => {
        vi.spyOn(
          aiModelSelectorsModule.aiModelSelectors,
          'modelDefaultExtendParams',
        ).mockReturnValue(() => createDefaultParams({ enableReasoning: false }));

        const result = resolveModelExtendParams({
          model: 'gpt-4',
          provider: 'openai',
        });

        expect(result.thinking).toEqual({
          budget_tokens: 0,
          type: 'disabled',
        });
      });

      it('should preserve legacy thinking disabled when enableReasoning is unset', () => {
        vi.spyOn(
          aiModelSelectorsModule.aiModelSelectors,
          'modelDefaultExtendParams',
        ).mockReturnValue(() => createDefaultParams({ thinking: 'disabled' }));

        const result = resolveModelExtendParams({
          model: 'deepseek-v4-flash',
          provider: 'deepseek',
        });

        expect(result.thinking).toEqual({
          budget_tokens: 0,
          type: 'disabled',
        });
      });

      it('should preserve legacy thinking enabled when enableReasoning is unset', () => {
        vi.spyOn(
          aiModelSelectorsModule.aiModelSelectors,
          'modelDefaultExtendParams',
        ).mockReturnValue(() => createDefaultParams({ thinking: 'enabled' }));

        const result = resolveModelExtendParams({
          model: 'deepseek-v4-flash',
          provider: 'deepseek',
        });

        expect(result.thinking).toEqual({
          budget_tokens: 1024,
          type: 'enabled',
        });
      });
    });

    describe('reasoningBudgetToken only param', () => {
      beforeEach(() => {
        vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'isModelHasExtendParams').mockReturnValue(
          () => true,
        );
        vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelExtendParams').mockReturnValue(
          () => ['reasoningBudgetToken'],
        );
      });

      it('should only set thinking budget when only reasoningBudgetToken is supported', () => {
        vi.spyOn(
          aiModelSelectorsModule.aiModelSelectors,
          'modelDefaultExtendParams',
        ).mockReturnValue(() => createDefaultParams({ reasoningBudgetToken: 4096 }));

        const result = resolveModelExtendParams({
          model: 'claude-3',
          provider: 'anthropic',
        });

        expect(result.thinking).toEqual({
          budget_tokens: 4096,
        });
      });

      it('should use default budget when reasoningBudgetToken is not provided', () => {
        vi.spyOn(
          aiModelSelectorsModule.aiModelSelectors,
          'modelDefaultExtendParams',
        ).mockReturnValue(() => createDefaultParams());

        const result = resolveModelExtendParams({
          model: 'claude-3',
          provider: 'anthropic',
        });

        expect(result.thinking).toEqual({
          budget_tokens: 1024,
        });
      });
    });
  });

  describe('context caching', () => {
    beforeEach(() => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'isModelHasExtendParams').mockReturnValue(
        () => true,
      );
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelExtendParams').mockReturnValue(() => [
        'disableContextCaching',
      ]);
    });

    it('should set enabledContextCaching to false when disableContextCaching is true', () => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
        () => createDefaultParams({ disableContextCaching: true }),
      );

      const result = resolveModelExtendParams({
        model: 'gpt-4',
        provider: 'openai',
      });

      expect(result.enabledContextCaching).toBe(false);
    });

    it('should not set enabledContextCaching when disableContextCaching is false', () => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
        () => createDefaultParams({ disableContextCaching: false }),
      );

      const result = resolveModelExtendParams({
        model: 'gpt-4',
        provider: 'openai',
      });

      expect(result.enabledContextCaching).toBeUndefined();
    });

    it('should not set enabledContextCaching when disableContextCaching is not provided', () => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
        () => createDefaultParams(),
      );

      const result = resolveModelExtendParams({
        model: 'gpt-4',
        provider: 'openai',
      });

      expect(result.enabledContextCaching).toBeUndefined();
    });
  });

  describe('reasoning effort variants', () => {
    describe('reasoningEffort param', () => {
      beforeEach(() => {
        vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'isModelHasExtendParams').mockReturnValue(
          () => true,
        );
        vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelExtendParams').mockReturnValue(
          () => ['reasoningEffort'],
        );
      });

      it('should set reasoning_effort when supported and configured', () => {
        vi.spyOn(
          aiModelSelectorsModule.aiModelSelectors,
          'modelDefaultExtendParams',
        ).mockReturnValue(() => createDefaultParams({ reasoningEffort: 'medium' }));

        const result = resolveModelExtendParams({
          model: 'gpt-4',
          provider: 'openai',
        });

        expect(result.reasoning_effort).toBe('medium');
      });

      it('should not set reasoning_effort when not configured', () => {
        vi.spyOn(
          aiModelSelectorsModule.aiModelSelectors,
          'modelDefaultExtendParams',
        ).mockReturnValue(() => createDefaultParams());

        const result = resolveModelExtendParams({
          model: 'gpt-4',
          provider: 'openai',
        });

        expect(result.reasoning_effort).toBeUndefined();
      });
    });

    describe('deepseekV4ReasoningEffort param', () => {
      beforeEach(() => {
        vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'isModelHasExtendParams').mockReturnValue(
          () => true,
        );
        vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelExtendParams').mockReturnValue(
          () => ['deepseekV4ReasoningEffort'],
        );
      });

      it('should enable thinking and set reasoning_effort for DeepSeek when configured with a reasoning level', () => {
        vi.spyOn(
          aiModelSelectorsModule.aiModelSelectors,
          'modelDefaultExtendParams',
        ).mockReturnValue(() => createDefaultParams({ deepseekV4ReasoningEffort: 'high' }));

        const result = resolveModelExtendParams({
          model: 'deepseek-v4-pro',
          provider: 'deepseek',
        });

        expect(result).toEqual({
          reasoning_effort: 'high',
          thinking: { type: 'enabled' },
        });
      });

      it('should disable thinking and omit reasoning_effort for DeepSeek when configured as none', () => {
        vi.spyOn(
          aiModelSelectorsModule.aiModelSelectors,
          'modelDefaultExtendParams',
        ).mockReturnValue(() => createDefaultParams({ deepseekV4ReasoningEffort: 'none' }));

        const result = resolveModelExtendParams({
          model: 'deepseek-v4-pro',
          provider: 'deepseek',
        });

        expect(result).toEqual({
          thinking: { type: 'disabled' },
        });
      });
    });

    describe('gpt5ReasoningEffort param', () => {
      beforeEach(() => {
        vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'isModelHasExtendParams').mockReturnValue(
          () => true,
        );
        vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelExtendParams').mockReturnValue(
          () => ['gpt5ReasoningEffort'],
        );
      });

      it('should set reasoning_effort for gpt5 variant', () => {
        vi.spyOn(
          aiModelSelectorsModule.aiModelSelectors,
          'modelDefaultExtendParams',
        ).mockReturnValue(() => createDefaultParams({ gpt5ReasoningEffort: 'high' }));

        const result = resolveModelExtendParams({
          model: 'gpt-5',
          provider: 'openai',
        });

        expect(result.reasoning_effort).toBe('high');
      });
    });

    describe('gpt5_1ReasoningEffort param', () => {
      beforeEach(() => {
        vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'isModelHasExtendParams').mockReturnValue(
          () => true,
        );
        vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelExtendParams').mockReturnValue(
          () => ['gpt5_1ReasoningEffort'],
        );
      });

      it('should set reasoning_effort for gpt5.1 variant', () => {
        vi.spyOn(
          aiModelSelectorsModule.aiModelSelectors,
          'modelDefaultExtendParams',
        ).mockReturnValue(() => createDefaultParams({ gpt5_1ReasoningEffort: 'low' }));

        const result = resolveModelExtendParams({
          model: 'gpt-5.1',
          provider: 'openai',
        });

        expect(result.reasoning_effort).toBe('low');
      });
    });

    describe('gpt5_2ReasoningEffort param', () => {
      beforeEach(() => {
        vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'isModelHasExtendParams').mockReturnValue(
          () => true,
        );
        vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelExtendParams').mockReturnValue(
          () => ['gpt5_2ReasoningEffort'],
        );
      });

      it('should set reasoning_effort for gpt5.2 variant', () => {
        vi.spyOn(
          aiModelSelectorsModule.aiModelSelectors,
          'modelDefaultExtendParams',
        ).mockReturnValue(() => createDefaultParams({ gpt5_2ReasoningEffort: 'medium' }));

        const result = resolveModelExtendParams({
          model: 'gpt-5.2',
          provider: 'openai',
        });

        expect(result.reasoning_effort).toBe('medium');
      });
    });

    describe('gpt5_2ProReasoningEffort param', () => {
      beforeEach(() => {
        vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'isModelHasExtendParams').mockReturnValue(
          () => true,
        );
        vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelExtendParams').mockReturnValue(
          () => ['gpt5_2ProReasoningEffort'],
        );
      });

      it('should set reasoning_effort for gpt5.2-pro variant', () => {
        vi.spyOn(
          aiModelSelectorsModule.aiModelSelectors,
          'modelDefaultExtendParams',
        ).mockReturnValue(() => createDefaultParams({ gpt5_2ProReasoningEffort: 'high' }));

        const result = resolveModelExtendParams({
          model: 'gpt-5.2-pro',
          provider: 'openai',
        });

        expect(result.reasoning_effort).toBe('high');
      });
    });

    it('should not set reasoning_effort when deepseekV4ReasoningEffort is not configured', () => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'isModelHasExtendParams').mockReturnValue(
        () => true,
      );
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelExtendParams').mockReturnValue(() => [
        'deepseekV4ReasoningEffort',
      ]);
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
        () => createDefaultParams(),
      );

      const result = resolveModelExtendParams({
        model: 'deepseek-v4-flash',
        provider: 'deepseek',
      });

      expect(result.reasoning_effort).toBeUndefined();
    });
  });
});

describe('text verbosity', () => {
  beforeEach(() => {
    vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'isModelHasExtendParams').mockReturnValue(
      () => true,
    );
    vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelExtendParams').mockReturnValue(() => [
      'textVerbosity',
    ]);
  });

  it('should set verbosity when textVerbosity is supported and configured', () => {
    vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
      () => ({ textVerbosity: 'low' }),
    );

    const result = resolveModelExtendParams({ model: 'model', provider: 'provider' });

    expect(result.verbosity).toBe('low');
  });

  it('should not set verbosity when textVerbosity is not configured', () => {
    vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
      () => ({}),
    );

    const result = resolveModelExtendParams({ model: 'model', provider: 'provider' });

    expect(result.verbosity).toBeUndefined();
  });
});

describe('thinking configuration', () => {
  describe('thinking param', () => {
    beforeEach(() => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'isModelHasExtendParams').mockReturnValue(
        () => true,
      );
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelExtendParams').mockReturnValue(() => [
        'thinking',
      ]);
    });

    it('should set thinking type when supported and configured', () => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
        () => ({ thinking: 'auto' }),
      );

      const result = resolveModelExtendParams({ model: 'deepseek', provider: 'deepseek' });

      expect(result.thinking).toEqual({ type: 'auto' });
    });

    it('should not set thinking when not configured', () => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
        () => ({}),
      );

      const result = resolveModelExtendParams({ model: 'deepseek', provider: 'deepseek' });

      expect(result.thinking).toBeUndefined();
    });
  });

  describe('thinkingBudget param', () => {
    beforeEach(() => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'isModelHasExtendParams').mockReturnValue(
        () => true,
      );
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelExtendParams').mockReturnValue(() => [
        'thinkingBudget',
      ]);
    });

    it('should set thinkingBudget when supported and configured with value', () => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
        () => ({ thinkingBudget: 5000 }),
      );

      const result = resolveModelExtendParams({ model: 'model', provider: 'provider' });

      expect(result.thinkingBudget).toBe(5000);
    });

    it('should set thinkingBudget to 0 when explicitly set to 0', () => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
        () => ({ thinkingBudget: 0 }),
      );

      const result = resolveModelExtendParams({ model: 'model', provider: 'provider' });

      expect(result.thinkingBudget).toBe(0);
    });

    it('should not set thinkingBudget when undefined', () => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
        () => ({}),
      );

      const result = resolveModelExtendParams({ model: 'model', provider: 'provider' });

      expect(result.thinkingBudget).toBeUndefined();
    });
  });

  describe('thinkingLevel param', () => {
    beforeEach(() => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'isModelHasExtendParams').mockReturnValue(
        () => true,
      );
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelExtendParams').mockReturnValue(() => [
        'thinkingLevel',
      ]);
    });

    it('should set thinkingLevel when supported and configured', () => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
        () => ({ thinkingLevel: 'high' }),
      );

      const result = resolveModelExtendParams({ model: 'model', provider: 'provider' });

      expect(result.thinkingLevel).toBe('high');
    });

    it("should use default 'high' thinkingLevel when not configured", () => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
        () => ({}),
      );

      const result = resolveModelExtendParams({ model: 'model', provider: 'provider' });

      expect(result.thinkingLevel).toBe('high');
    });

    it('should set thinkingLevel from thinkingLevel config key for gemini-3.5-flash', () => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
        () => ({ thinkingLevel: 'low' }),
      );

      const result = resolveModelExtendParams({ model: 'gemini-3.5-flash', provider: 'google' });

      expect(result.thinkingLevel).toBe('low');
    });

    it('should use the model default thinkingLevel for gemini-3.5-flash when not configured', () => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
        () => ({}),
      );

      const result = resolveModelExtendParams({ model: 'gemini-3.5-flash', provider: 'google' });

      expect(result.thinkingLevel).toBe('medium');
    });

    it('should reuse thinkingLevel for Gemini 3.1 Flash-Lite models', () => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
        () => ({ thinkingLevel: 'medium' }),
      );

      const result = resolveModelExtendParams({
        model: 'gemini-3.1-flash-lite-preview',
        provider: 'google',
      });

      expect(result.thinkingLevel).toBe('medium');
    });

    it('should use the Flash-Lite default thinkingLevel when not configured', () => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
        () => ({}),
      );

      const result = resolveModelExtendParams({
        model: 'gemini-3.1-flash-lite-preview',
        provider: 'google',
      });

      expect(result.thinkingLevel).toBe('minimal');
    });
  });

  describe('thinkingLevel2 param', () => {
    beforeEach(() => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'isModelHasExtendParams').mockReturnValue(
        () => true,
      );
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelExtendParams').mockReturnValue(() => [
        'thinkingLevel2',
      ]);
    });

    it('should set thinkingLevel from thinkingLevel2 config key', () => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
        () => ({ thinkingLevel2: 'low' }),
      );

      const result = resolveModelExtendParams({
        model: 'gemini-3.1-pro-preview',
        provider: 'google',
      });

      expect(result.thinkingLevel).toBe('low');
    });

    it('should not set thinkingLevel when thinkingLevel2 is not configured', () => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
        () => ({}),
      );

      const result = resolveModelExtendParams({
        model: 'gemini-3.1-pro-preview',
        provider: 'google',
      });

      expect(result.thinkingLevel).toBe('high');
    });
  });

  describe('thinkingLevel3 param', () => {
    beforeEach(() => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'isModelHasExtendParams').mockReturnValue(
        () => true,
      );
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelExtendParams').mockReturnValue(() => [
        'thinkingLevel3',
      ]);
    });

    it('should set thinkingLevel from thinkingLevel3 config key', () => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
        () => ({ thinkingLevel3: 'medium' }),
      );

      const result = resolveModelExtendParams({
        model: 'gemini-3.1-pro-preview',
        provider: 'google',
      });

      expect(result.thinkingLevel).toBe('medium');
    });

    it('should not set thinkingLevel when thinkingLevel3 is not configured', () => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
        () => ({}),
      );

      const result = resolveModelExtendParams({
        model: 'gemini-3.1-pro-preview',
        provider: 'google',
      });

      expect(result.thinkingLevel).toBe('high');
    });
  });

  describe('thinkingLevel4 param', () => {
    beforeEach(() => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'isModelHasExtendParams').mockReturnValue(
        () => true,
      );
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelExtendParams').mockReturnValue(() => [
        'thinkingLevel4',
      ]);
    });

    it('should set thinkingLevel from thinkingLevel4 config key', () => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
        () => ({ thinkingLevel4: 'minimal' }),
      );

      const result = resolveModelExtendParams({
        model: 'gemini-3.1-flash-image-preview',
        provider: 'google',
      });

      expect(result.thinkingLevel).toBe('minimal');
    });

    it('should use the default thinkingLevel when thinkingLevel4 is not configured', () => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
        () => ({}),
      );

      const result = resolveModelExtendParams({
        model: 'gemini-3.1-flash-image-preview',
        provider: 'google',
      });

      expect(result.thinkingLevel).toBe('minimal');
    });
  });

  describe('thinkingLevel selection order', () => {
    it('should use the first configured thinkingLevel* extend param in modelExtendParams order', () => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'isModelHasExtendParams').mockReturnValue(
        () => true,
      );
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelExtendParams').mockReturnValue(() => [
        'thinkingLevel',
        'thinkingLevel3',
      ]);
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
        () => ({ thinkingLevel: 'high', thinkingLevel3: 'medium' }),
      );

      const result = resolveModelExtendParams({
        model: 'gemini-3.1-pro-preview',
        provider: 'google',
      });

      expect(result.thinkingLevel).toBe('high');
    });

    it('should prefer the first configured thinkingLevel param before defaulting', () => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'isModelHasExtendParams').mockReturnValue(
        () => true,
      );
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelExtendParams').mockReturnValue(() => [
        'thinkingLevel',
        'thinkingLevel3',
      ]);
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
        () => ({ thinkingLevel3: 'medium' }),
      );

      const result = resolveModelExtendParams({
        model: 'gemini-3.1-pro-preview',
        provider: 'google',
      });

      expect(result.thinkingLevel).toBe('medium');
    });

    it('should fall back to the first supported thinkingLevel default when none are configured', () => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'isModelHasExtendParams').mockReturnValue(
        () => true,
      );
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelExtendParams').mockReturnValue(() => [
        'thinkingLevel4',
        'thinkingLevel3',
      ]);
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
        () => ({}),
      );

      const result = resolveModelExtendParams({
        model: 'gemini-3.1-pro-preview',
        provider: 'google',
      });

      expect(result.thinkingLevel).toBe('minimal');
    });
  });
});

describe('URL context', () => {
  beforeEach(() => {
    vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'isModelHasExtendParams').mockReturnValue(
      () => true,
    );
    vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelExtendParams').mockReturnValue(() => [
      'urlContext',
    ]);
  });

  it('should set urlContext when supported and enabled', () => {
    vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
      () => ({ urlContext: true }),
    );

    const result = resolveModelExtendParams({ model: 'model', provider: 'provider' });

    expect(result.urlContext).toBe(true);
  });

  it('should not set urlContext when false', () => {
    vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
      () => ({ urlContext: false }),
    );

    const result = resolveModelExtendParams({ model: 'model', provider: 'provider' });

    expect(result.urlContext).toBeUndefined();
  });

  it('should not set urlContext when not configured', () => {
    vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
      () => ({}),
    );

    const result = resolveModelExtendParams({ model: 'model', provider: 'provider' });

    expect(result.urlContext).toBeUndefined();
  });
});

describe('image generation params', () => {
  describe('imageAspectRatio param', () => {
    beforeEach(() => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'isModelHasExtendParams').mockReturnValue(
        () => true,
      );
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelExtendParams').mockReturnValue(() => [
        'imageAspectRatio',
      ]);
    });

    it('should set imageAspectRatio when supported and configured', () => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
        () => ({ imageAspectRatio: '16:9' }),
      );

      const result = resolveModelExtendParams({ model: 'dall-e-3', provider: 'openai' });

      expect(result.imageAspectRatio).toBe('16:9');
    });

    it('should not set imageAspectRatio when not configured', () => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
        () => ({}),
      );

      const result = resolveModelExtendParams({ model: 'dall-e-3', provider: 'openai' });

      expect(result.imageAspectRatio).toBeUndefined();
    });
  });

  describe('imageResolution param', () => {
    beforeEach(() => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'isModelHasExtendParams').mockReturnValue(
        () => true,
      );
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelExtendParams').mockReturnValue(() => [
        'imageResolution',
      ]);
    });

    it('should set imageResolution when supported and configured', () => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
        () => ({ imageResolution: '1K' }),
      );

      const result = resolveModelExtendParams({ model: 'dall-e-3', provider: 'openai' });

      expect(result.imageResolution).toBe('1K');
    });

    it('should not set imageResolution when not configured', () => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
        () => ({}),
      );

      const result = resolveModelExtendParams({ model: 'dall-e-3', provider: 'openai' });

      expect(result.imageResolution).toBeUndefined();
    });
  });
});

describe('multiple params combination', () => {
  beforeEach(() => {
    vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'isModelHasExtendParams').mockReturnValue(
      () => true,
    );
  });

  it('should handle multiple params together correctly', () => {
    vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelExtendParams').mockReturnValue(() => [
      'enableReasoning',
      'reasoningEffort',
      'textVerbosity',
      'urlContext',
      'disableContextCaching',
    ]);
    vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
      () => ({
        disableContextCaching: true,
        enableReasoning: true,
        reasoningBudgetToken: 3072,
        reasoningEffort: 'high',
        textVerbosity: 'low',
        urlContext: true,
      }),
    );

    const result = resolveModelExtendParams({ model: 'gpt-4', provider: 'openai' });

    expect(result).toEqual({
      enabledContextCaching: false,
      reasoning_effort: 'high',
      thinking: { budget_tokens: 3072, type: 'enabled' },
      urlContext: true,
      verbosity: 'low',
    });
  });

  it('should only set params that are both supported and configured', () => {
    vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelExtendParams').mockReturnValue(() => [
      'enableReasoning',
      'textVerbosity',
    ]);
    vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
      () => ({
        enableReasoning: true,
        reasoningBudgetToken: 2048,
        textVerbosity: 'high',
      }),
    );

    const result = resolveModelExtendParams({ model: 'model', provider: 'provider' });

    expect(result).toEqual({
      thinking: { budget_tokens: 2048, type: 'enabled' },
      verbosity: 'high',
    });
    expect(result.imageAspectRatio).toBeUndefined();
    expect(result.urlContext).toBeUndefined();
  });

  it('should handle image generation params together', () => {
    vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelExtendParams').mockReturnValue(() => [
      'imageAspectRatio',
      'imageResolution',
    ]);
    vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
      () => ({ imageAspectRatio: '4:3', imageResolution: '2K' }),
    );

    const result = resolveModelExtendParams({ model: 'dall-e-3', provider: 'openai' });

    expect(result).toEqual({ imageAspectRatio: '4:3', imageResolution: '2K' });
  });

  it('should handle all thinking-related params together', () => {
    vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelExtendParams').mockReturnValue(() => [
      'thinking',
      'thinkingBudget',
      'thinkingLevel',
    ]);
    vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
      () => ({ thinking: 'enabled', thinkingBudget: 8000, thinkingLevel: 'high' }),
    );

    const result = resolveModelExtendParams({ model: 'deepseek', provider: 'deepseek' });

    expect(result).toEqual({
      thinking: { type: 'enabled' },
      thinkingBudget: 8000,
      thinkingLevel: 'high',
    });
  });
});

describe('edge cases', () => {
  beforeEach(() => {
    vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'isModelHasExtendParams').mockReturnValue(
      () => true,
    );
    vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelExtendParams').mockReturnValue(() => [
      'enableReasoning',
      'textVerbosity',
      'urlContext',
      'thinkingBudget',
    ]);
  });

  it('should handle empty defaultExtendParams', () => {
    vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
      () => ({}),
    );

    const result = resolveModelExtendParams({ model: 'model', provider: 'provider' });

    expect(result.thinking).toEqual({ budget_tokens: 0, type: 'disabled' });
    expect(result.verbosity).toBeUndefined();
    expect(result.urlContext).toBeUndefined();
    expect(result.thinkingBudget).toBeUndefined();
  });

  it('should handle null/undefined defaultExtendParams values gracefully', () => {
    vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
      () => ({
        enableReasoning: undefined,
        textVerbosity: null as any,
        urlContext: undefined,
      }),
    );

    const result = resolveModelExtendParams({ model: 'model', provider: 'provider' });

    expect(result).toEqual({ thinking: { budget_tokens: 0, type: 'disabled' } });
  });

  it('should handle empty modelExtendParams array', () => {
    vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelExtendParams').mockReturnValue(
      () => [],
    );

    const result = resolveModelExtendParams({ model: 'model', provider: 'provider' });

    expect(result).toEqual({});
  });

  it('should verify selectors are called with correct parameters', () => {
    const isModelHasExtendParamsSpy = vi
      .spyOn(aiModelSelectorsModule.aiModelSelectors, 'isModelHasExtendParams')
      .mockReturnValue(() => true);
    const modelExtendParamsSpy = vi
      .spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelExtendParams')
      .mockReturnValue(() => ['enableReasoning']);
    const modelDefaultExtendParamsSpy = vi
      .spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams')
      .mockReturnValue(() => ({}));

    resolveModelExtendParams({ model: 'test-model', provider: 'test-provider' });

    expect(isModelHasExtendParamsSpy).toHaveBeenCalledWith('test-model', 'test-provider');
    expect(modelExtendParamsSpy).toHaveBeenCalledWith('test-model', 'test-provider');
    expect(modelDefaultExtendParamsSpy).toHaveBeenCalledWith('test-model', 'test-provider');
  });
});

describe('parameter precedence and conflicts', () => {
  beforeEach(() => {
    vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'isModelHasExtendParams').mockReturnValue(
      () => true,
    );
  });

  describe('reasoning effort variants precedence', () => {
    it('should prioritize deepseekV4ReasoningEffort over generic reasoningEffort when both are supported', () => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelExtendParams').mockReturnValue(() => [
        'deepseekV4ReasoningEffort',
        'reasoningEffort',
      ]);
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
        () => ({ deepseekV4ReasoningEffort: 'high', reasoningEffort: 'low' }),
      );

      const result = resolveModelExtendParams({ model: 'deepseek-v4-pro', provider: 'deepseek' });

      expect(result).toEqual({
        reasoning_effort: 'high',
        thinking: { type: 'enabled' },
      });
    });

    it('should omit reasoning_effort when deepseekV4ReasoningEffort is none even if other variants are configured', () => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelExtendParams').mockReturnValue(() => [
        'deepseekV4ReasoningEffort',
        'reasoningEffort',
        'gpt5ReasoningEffort',
      ]);
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
        () => ({
          deepseekV4ReasoningEffort: 'none',
          gpt5ReasoningEffort: 'medium',
          reasoningEffort: 'high',
        }),
      );

      const result = resolveModelExtendParams({ model: 'deepseek-v4-pro', provider: 'deepseek' });

      expect(result).toEqual({ thinking: { type: 'disabled' } });
    });

    it('should allow other reasoning_effort variants when deepseekV4ReasoningEffort is supported but unset', () => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelExtendParams').mockReturnValue(() => [
        'deepseekV4ReasoningEffort',
        'reasoningEffort',
      ]);
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
        () => ({ reasoningEffort: 'low' }),
      );

      const result = resolveModelExtendParams({ model: 'deepseek-v4-pro', provider: 'deepseek' });

      expect(result).toEqual({ reasoning_effort: 'low' });
    });

    it('should give precedence to later reasoning effort variants when multiple are configured', () => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelExtendParams').mockReturnValue(() => [
        'reasoningEffort',
        'gpt5ReasoningEffort',
        'gpt5_1ReasoningEffort',
      ]);
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
        () => ({
          gpt5_1ReasoningEffort: 'high',
          gpt5ReasoningEffort: 'medium',
          reasoningEffort: 'low',
        }),
      );

      const result = resolveModelExtendParams({ model: 'gpt-5.1', provider: 'openai' });

      expect(result.reasoning_effort).toBe('high');
    });

    it('should handle mixed reasoning effort variants with only some configured', () => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelExtendParams').mockReturnValue(() => [
        'reasoningEffort',
        'gpt5ReasoningEffort',
        'gpt5_2ReasoningEffort',
        'gpt5_2ProReasoningEffort',
      ]);
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
        () => ({
          gpt5_2ProReasoningEffort: undefined,
          gpt5_2ReasoningEffort: 'medium',
          gpt5ReasoningEffort: undefined,
          reasoningEffort: 'low',
        }),
      );

      const result = resolveModelExtendParams({ model: 'gpt-5.2', provider: 'openai' });

      expect(result.reasoning_effort).toBe('medium');
    });

    it('should use the last supported variant in processing order', () => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelExtendParams').mockReturnValue(() => [
        'reasoningEffort',
        'gpt5_2ProReasoningEffort',
      ]);
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
        () => ({ gpt5_2ProReasoningEffort: 'high', reasoningEffort: 'low' }),
      );

      const result = resolveModelExtendParams({ model: 'gpt-5.2-pro', provider: 'openai' });

      expect(result.reasoning_effort).toBe('high');
    });
  });

  describe('thinking configuration conflicts', () => {
    it('should allow thinking type param to overwrite enableReasoning thinking config', () => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelExtendParams').mockReturnValue(() => [
        'enableReasoning',
        'thinking',
      ]);
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
        () => ({
          enableReasoning: true,
          reasoningBudgetToken: 2048,
          thinking: 'auto',
        }),
      );

      const result = resolveModelExtendParams({ model: 'model', provider: 'provider' });

      expect(result.thinking).toEqual({ type: 'auto' });
    });

    it('should handle reasoningBudgetToken with thinking type param', () => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelExtendParams').mockReturnValue(() => [
        'reasoningBudgetToken',
        'thinking',
      ]);
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
        () => ({ reasoningBudgetToken: 4096, thinking: 'enabled' }),
      );

      const result = resolveModelExtendParams({ model: 'model', provider: 'provider' });

      expect(result.thinking).toEqual({ type: 'enabled' });
    });

    it('should combine independent thinking params without conflict', () => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelExtendParams').mockReturnValue(() => [
        'thinking',
        'thinkingBudget',
        'thinkingLevel',
      ]);
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
        () => ({ thinking: 'enabled', thinkingBudget: 5000, thinkingLevel: 'high' }),
      );

      const result = resolveModelExtendParams({ model: 'model', provider: 'provider' });

      expect(result.thinking).toEqual({ type: 'enabled' });
      expect(result.thinkingBudget).toBe(5000);
      expect(result.thinkingLevel).toBe('high');
    });
  });

  describe('adaptive thinking configuration', () => {
    it('should set adaptive thinking when enabled', () => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelExtendParams').mockReturnValue(() => [
        'enableAdaptiveThinking',
      ]);
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
        () => ({ enableAdaptiveThinking: true }),
      );

      const result = resolveModelExtendParams({ model: 'claude-opus-4-6', provider: 'anthropic' });

      expect(result.thinking).toEqual({ type: 'adaptive' });
    });

    it('should disable adaptive thinking when off', () => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelExtendParams').mockReturnValue(() => [
        'enableAdaptiveThinking',
      ]);
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
        () => ({ enableAdaptiveThinking: false }),
      );

      const result = resolveModelExtendParams({ model: 'claude-opus-4-6', provider: 'anthropic' });

      expect(result.thinking).toEqual({ type: 'disabled' });
    });

    it('should set adaptive thinking effort when configured', () => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelExtendParams').mockReturnValue(() => [
        'effort',
      ]);
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
        () => ({ effort: 'max' }),
      );

      const result = resolveModelExtendParams({ model: 'claude-opus-4-6', provider: 'anthropic' });

      expect(result.effort).toBe('max');
    });
  });

  describe('complex multi-parameter scenarios', () => {
    it('should handle all reasoning variants with context caching and verbosity', () => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelExtendParams').mockReturnValue(() => [
        'enableReasoning',
        'reasoningEffort',
        'gpt5ReasoningEffort',
        'disableContextCaching',
        'textVerbosity',
      ]);
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
        () => ({
          disableContextCaching: true,
          enableReasoning: true,
          gpt5ReasoningEffort: 'high',
          reasoningBudgetToken: 3000,
          reasoningEffort: 'medium',
          textVerbosity: 'high',
        }),
      );

      const result = resolveModelExtendParams({ model: 'gpt-5', provider: 'openai' });

      expect(result).toEqual({
        enabledContextCaching: false,
        reasoning_effort: 'high',
        thinking: { budget_tokens: 3000, type: 'enabled' },
        verbosity: 'high',
      });
    });

    it('should handle all params when none are configured', () => {
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelExtendParams').mockReturnValue(() => [
        'enableReasoning',
        'reasoningEffort',
        'textVerbosity',
        'thinking',
        'thinkingBudget',
        'thinkingLevel',
        'urlContext',
        'imageAspectRatio',
        'imageResolution',
        'disableContextCaching',
      ]);
      vi.spyOn(aiModelSelectorsModule.aiModelSelectors, 'modelDefaultExtendParams').mockReturnValue(
        () => ({}),
      );

      const result = resolveModelExtendParams({ model: 'model', provider: 'provider' });

      expect(result.thinking).toEqual({ budget_tokens: 0, type: 'disabled' });
      expect(result.reasoning_effort).toBeUndefined();
      expect(result.verbosity).toBeUndefined();
      expect(result.thinkingBudget).toBeUndefined();
      expect(result.thinkingLevel).toBe('high');
      expect(result.urlContext).toBeUndefined();
      expect(result.imageAspectRatio).toBeUndefined();
      expect(result.imageResolution).toBeUndefined();
      expect(result.enabledContextCaching).toBeUndefined();
    });
  });
});
