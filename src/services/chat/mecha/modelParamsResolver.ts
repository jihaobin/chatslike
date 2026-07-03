import type { ExtendParamsType, ExtendParamsValues } from 'model-bank';

import { aiModelSelectors, getAiInfraStoreState } from '@/store/aiInfra';

export interface ModelParamsContext {
  model: string;
  provider: string;
}

export interface ModelExtendParams {
  deepseekV4ReasoningEffort?: string;
  effort?: string;
  enabledContextCaching?: boolean;
  imageAspectRatio?: string;
  imageResolution?: string;
  reasoning_effort?: string;
  thinking?: {
    budget_tokens?: number;
    type?: string;
  };
  thinkingBudget?: number;
  thinkingLevel?: string;
  urlContext?: boolean;
  verbosity?: string;
}

type ThinkingLevelExtendParam =
  'thinkingLevel' | 'thinkingLevel2' | 'thinkingLevel3' | 'thinkingLevel4';

type ThinkingLevelValue = NonNullable<ExtendParamsValues['thinkingLevel']>;

const DEFAULT_THINKING_LEVEL_BY_EXTEND_PARAM = {
  thinkingLevel: 'high',
  thinkingLevel2: 'high',
  thinkingLevel3: 'high',
  thinkingLevel4: 'minimal',
} as const satisfies Record<ThinkingLevelExtendParam, ThinkingLevelValue>;

const MODEL_THINKING_LEVEL_DEFAULTS: Partial<
  Record<string, Partial<Record<ThinkingLevelExtendParam, ThinkingLevelValue>>>
> = {
  'gemini-3.5-flash': {
    thinkingLevel: 'medium',
  },
  'gemini-3.1-flash-lite': {
    thinkingLevel: 'minimal',
  },
  'gemini-3.1-flash-lite-preview': {
    thinkingLevel: 'minimal',
  },
} as const;

/**
 * Preserves legacy `thinking` preferences set before `enableReasoning` was introduced.
 */
const resolveEnableReasoningValue = (params: ExtendParamsValues): boolean | undefined => {
  if (Object.hasOwn(params, 'enableReasoning')) return params.enableReasoning;

  if (params.thinking === 'enabled') return true;
  if (params.thinking === 'disabled') return false;

  return undefined;
};

const resolveThinkingLevelDefault = (
  model: string,
  extendParam: ThinkingLevelExtendParam,
): ThinkingLevelValue => {
  return (
    MODEL_THINKING_LEVEL_DEFAULTS[model]?.[extendParam] ??
    DEFAULT_THINKING_LEVEL_BY_EXTEND_PARAM[extendParam]
  );
};

const isThinkingLevelExtendParam = (
  extendParam: ExtendParamsType,
): extendParam is ThinkingLevelExtendParam => extendParam in DEFAULT_THINKING_LEVEL_BY_EXTEND_PARAM;

export const resolveModelExtendParams = (ctx: ModelParamsContext): ModelExtendParams => {
  const { model, provider } = ctx;
  const extendParams: ModelExtendParams = {};

  const aiInfraStoreState = getAiInfraStoreState();

  const isModelHasExtendParams = aiModelSelectors.isModelHasExtendParams(
    model,
    provider,
  )(aiInfraStoreState);

  if (!isModelHasExtendParams) {
    return extendParams;
  }

  const modelExtendParams = aiModelSelectors.modelExtendParams(model, provider)(aiInfraStoreState);

  if (!modelExtendParams) {
    return extendParams;
  }

  const defaultExtendParams =
    aiModelSelectors.modelDefaultExtendParams(model, provider)(aiInfraStoreState) ?? {};

  // Reasoning configuration
  if (modelExtendParams.includes('enableReasoning')) {
    const enableReasoning = resolveEnableReasoningValue(defaultExtendParams);

    if (enableReasoning) {
      const thinking: NonNullable<ModelExtendParams['thinking']> = {
        type: 'enabled',
      };

      let budgetTokens: number | undefined;
      if (modelExtendParams.includes('reasoningBudgetToken32k')) {
        budgetTokens = defaultExtendParams.reasoningBudgetToken32k || 1024;
      } else if (modelExtendParams.includes('reasoningBudgetToken80k')) {
        budgetTokens = defaultExtendParams.reasoningBudgetToken80k || 1024;
      } else {
        budgetTokens = defaultExtendParams.reasoningBudgetToken || 1024;
      }

      thinking.budget_tokens = budgetTokens;
      extendParams.thinking = thinking;
    } else {
      extendParams.thinking = {
        budget_tokens: 0,
        type: 'disabled',
      };
    }
  } else if (modelExtendParams.includes('reasoningBudgetToken32k')) {
    extendParams.thinking = {
      budget_tokens: defaultExtendParams.reasoningBudgetToken32k || 1024,
      type: 'enabled',
    };
  } else if (modelExtendParams.includes('reasoningBudgetToken80k')) {
    extendParams.thinking = {
      budget_tokens: defaultExtendParams.reasoningBudgetToken80k || 1024,
      type: 'enabled',
    };
  } else if (modelExtendParams.includes('reasoningBudgetToken')) {
    extendParams.thinking = {
      budget_tokens: defaultExtendParams.reasoningBudgetToken || 1024,
    };
  }

  // Adaptive thinking (Claude Opus/Sonnet 4.6)
  if (modelExtendParams.includes('enableAdaptiveThinking')) {
    if (defaultExtendParams.enableAdaptiveThinking) {
      extendParams.thinking = {
        type: 'adaptive',
      };
    } else if (!modelExtendParams.includes('enableReasoning')) {
      extendParams.thinking = {
        type: 'disabled',
      };
    }
  }

  // Context caching
  if (
    modelExtendParams.includes('disableContextCaching') &&
    defaultExtendParams.disableContextCaching
  ) {
    extendParams.enabledContextCaching = false;
  }

  // Reasoning effort variants
  if (modelExtendParams.includes('reasoningEffort') && defaultExtendParams.reasoningEffort) {
    extendParams.reasoning_effort = defaultExtendParams.reasoningEffort;
  }

  if (
    modelExtendParams.includes('gpt5ReasoningEffort') &&
    defaultExtendParams.gpt5ReasoningEffort
  ) {
    extendParams.reasoning_effort = defaultExtendParams.gpt5ReasoningEffort;
  }

  if (
    modelExtendParams.includes('gpt5_1ReasoningEffort') &&
    defaultExtendParams.gpt5_1ReasoningEffort
  ) {
    extendParams.reasoning_effort = defaultExtendParams.gpt5_1ReasoningEffort;
  }

  if (
    modelExtendParams.includes('gpt5_2ReasoningEffort') &&
    defaultExtendParams.gpt5_2ReasoningEffort
  ) {
    extendParams.reasoning_effort = defaultExtendParams.gpt5_2ReasoningEffort;
  }

  if (
    modelExtendParams.includes('gpt5_2ProReasoningEffort') &&
    defaultExtendParams.gpt5_2ProReasoningEffort
  ) {
    extendParams.reasoning_effort = defaultExtendParams.gpt5_2ProReasoningEffort;
  }

  if (
    modelExtendParams.includes('grok4_20ReasoningEffort') &&
    defaultExtendParams.grok4_20ReasoningEffort
  ) {
    extendParams.reasoning_effort = defaultExtendParams.grok4_20ReasoningEffort;
  }

  if (
    modelExtendParams.includes('grok4_3ReasoningEffort') &&
    defaultExtendParams.grok4_3ReasoningEffort
  ) {
    extendParams.reasoning_effort = defaultExtendParams.grok4_3ReasoningEffort;
  }

  if (modelExtendParams.includes('hy3ReasoningEffort') && defaultExtendParams.hy3ReasoningEffort) {
    extendParams.reasoning_effort = defaultExtendParams.hy3ReasoningEffort;
  }

  if (
    modelExtendParams.includes('codexMaxReasoningEffort') &&
    defaultExtendParams.codexMaxReasoningEffort
  ) {
    extendParams.reasoning_effort = defaultExtendParams.codexMaxReasoningEffort;
  }

  // DeepSeek reasoning effort
  if (modelExtendParams.includes('deepseekV4ReasoningEffort')) {
    const deepseekV4ReasoningEffort = defaultExtendParams.deepseekV4ReasoningEffort;

    if (typeof deepseekV4ReasoningEffort === 'string') {
      if (deepseekV4ReasoningEffort === 'none') {
        delete extendParams.reasoning_effort;
        extendParams.thinking = {
          type: 'disabled',
        };
      } else {
        extendParams.reasoning_effort = deepseekV4ReasoningEffort;
        extendParams.thinking = {
          type: 'enabled',
        };
      }
    }
  }

  if (modelExtendParams.includes('effort') && defaultExtendParams.effort) {
    extendParams.effort = defaultExtendParams.effort;
  }

  if (modelExtendParams.includes('opus47Effort') && defaultExtendParams.opus47Effort) {
    extendParams.effort = defaultExtendParams.opus47Effort;
  }

  // Text verbosity
  if (modelExtendParams.includes('textVerbosity') && defaultExtendParams.textVerbosity) {
    extendParams.verbosity = defaultExtendParams.textVerbosity;
  }

  // Thinking configuration
  if (modelExtendParams.includes('thinking') && defaultExtendParams.thinking) {
    extendParams.thinking = { type: defaultExtendParams.thinking };
  }

  if (
    modelExtendParams.includes('thinkingBudget') &&
    defaultExtendParams.thinkingBudget !== undefined
  ) {
    extendParams.thinkingBudget = defaultExtendParams.thinkingBudget;
  }

  const supportedThinkingLevelParams = modelExtendParams.filter(isThinkingLevelExtendParam);

  for (const supportedThinkingLevelParam of supportedThinkingLevelParams) {
    const value = defaultExtendParams[supportedThinkingLevelParam];

    if (typeof value === 'string') {
      extendParams.thinkingLevel = value;
      break;
    }
  }

  if (!extendParams.thinkingLevel && supportedThinkingLevelParams.length > 0) {
    extendParams.thinkingLevel = resolveThinkingLevelDefault(
      model,
      supportedThinkingLevelParams[0],
    );
  }

  // URL context
  if (modelExtendParams.includes('urlContext') && defaultExtendParams.urlContext) {
    extendParams.urlContext = defaultExtendParams.urlContext;
  }

  // Image generation params
  if (modelExtendParams.includes('imageAspectRatio') && defaultExtendParams.imageAspectRatio) {
    extendParams.imageAspectRatio = defaultExtendParams.imageAspectRatio;
  }

  if (modelExtendParams.includes('imageAspectRatio2') && defaultExtendParams.imageAspectRatio2) {
    extendParams.imageAspectRatio = defaultExtendParams.imageAspectRatio2;
  }

  if (modelExtendParams.includes('imageResolution') && defaultExtendParams.imageResolution) {
    extendParams.imageResolution = defaultExtendParams.imageResolution;
  }

  if (modelExtendParams.includes('imageResolution2') && defaultExtendParams.imageResolution2) {
    extendParams.imageResolution = defaultExtendParams.imageResolution2;
  }

  return extendParams;
};
