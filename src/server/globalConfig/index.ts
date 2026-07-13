import { ENABLE_BUSINESS_FEATURES } from '@lobechat/business-const';

import { TRIAL_CREDITS } from '@/business/server/billing/constants';
import { getCommercialRuntimeConfig } from '@/business/shared/commercialRuntime';
import { getPlatformProviderStatus } from '@/business/shared/platformProviderStatus';
import { klavisEnv } from '@/config/klavis';
import { isDesktop } from '@/const/version';
import { appEnv, getAppConfig } from '@/envs/app';
import { authEnv } from '@/envs/auth';
import { fileEnv } from '@/envs/file';
import { imageEnv } from '@/envs/image';
import { knowledgeEnv } from '@/envs/knowledge';
import { langfuseEnv } from '@/envs/langfuse';
import { getLLMConfig } from '@/envs/llm';
import { toolsEnv } from '@/envs/tools';
import { parseSSOProviders } from '@/libs/better-auth/utils/server';
import { parseSystemAgent } from '@/server/globalConfig/parseSystemAgent';
import { type GlobalServerConfig } from '@/types/serverConfig';
import { cleanObject } from '@/utils/object';

import { genServerAiProvidersConfig } from './genServerAiProviderConfig';
import { parseAgentConfig } from './parseDefaultAgent';
import { parseFilesConfig } from './parseFilesConfig';
import { getPublicMemoryExtractionConfig } from './parseMemoryExtractionConfig';

/**
 * Get Better-Auth SSO providers list
 * Parses AUTH_SSO_PROVIDERS and returns enabled providers
 */
const getBetterAuthSSOProviders = () => {
  return parseSSOProviders(authEnv.AUTH_SSO_PROVIDERS);
};

// Environment variables are fixed at startup; cache the computed config for the
// lifetime of the process so that the 10+ async sub-calls (genServerAiProvidersConfig,
// getLLMConfig, etc.) only run once instead of on every SPA HTML request.
// This is the main contributor to the 1500ms+ TTFB measured in production.
let _configCache: Awaited<ReturnType<typeof _computeServerGlobalConfig>> | null = null;

// Pre-warm the cache at module load time (not on first request) so that the
// heavy computation happens during server startup, not when the first user hits /_spa/.
// This moves the 1-5s delay from TTFB to container boot time (invisible to users).
let _warmupPromise: Promise<void> | null = null;
if (typeof window === 'undefined') {
  // Only run on server-side (not in browser bundles)
  _warmupPromise = _computeServerGlobalConfig().then((config) => {
    _configCache = config;
    console.log('[globalConfig] Pre-warmed cache at startup');
  });
}

export const getServerGlobalConfig = async () => {
  // If warmup is still running (rare on fast cold-starts), wait for it
  if (_warmupPromise) await _warmupPromise;
  if (_configCache) return _configCache;
  // Fallback: compute now if warmup somehow failed
  _configCache = await _computeServerGlobalConfig();
  return _configCache;
};

async function _computeServerGlobalConfig() {
  const { DEFAULT_AGENT_CONFIG } = getAppConfig();
  const commercial = getCommercialRuntimeConfig({
    ENABLE_COMMERCIAL: process.env.ENABLE_COMMERCIAL,
    ENABLE_LOBEHUB_CLOUD_INTEGRATION: process.env.ENABLE_LOBEHUB_CLOUD_INTEGRATION,
    ENABLE_NATIVE_BILLING: process.env.ENABLE_NATIVE_BILLING,
    ENABLE_PLATFORM_HOSTED_MODELS: process.env.ENABLE_PLATFORM_HOSTED_MODELS,
    NEXT_PUBLIC_ENABLE_PLATFORM_BILLING: process.env.NEXT_PUBLIC_ENABLE_PLATFORM_BILLING,
  });
  const llmConfig = getLLMConfig() as Record<string, unknown>;

  const config: GlobalServerConfig = {
    aiProvider: await genServerAiProvidersConfig({
      ...(ENABLE_BUSINESS_FEATURES
        ? {
            lobehub: {
              enabled: true,
            },
          }
        : {}),
      azure: {
        enabledKey: 'ENABLED_AZURE_OPENAI',
        withDeploymentName: true,
      },
      azureai: {
        withDeploymentName: true,
      },
      bedrock: {
        enabledKey: 'ENABLED_AWS_BEDROCK',
        modelListKey: 'AWS_BEDROCK_MODEL_LIST',
      },
      deepseek: {
        enabled: true,
      },
      giteeai: {
        enabledKey: 'ENABLED_GITEE_AI',
        modelListKey: 'GITEE_AI_MODEL_LIST',
      },
      kimicodingplan: {
        withDeploymentName: true,
      },
      lmstudio: {
        fetchOnClient: isDesktop ? false : undefined,
      },
      ollama: {
        enabled: isDesktop ? true : undefined,
        fetchOnClient: isDesktop ? false : !process.env.OLLAMA_PROXY_URL,
      },
      ollamacloud: {
        enabledKey: 'ENABLED_OLLAMA_CLOUD',
      },
      qwen: {
        withDeploymentName: true,
      },
      spark: {
        withDeploymentName: true,
      },
      tencentcloud: {
        enabledKey: 'ENABLED_TENCENT_CLOUD',
        modelListKey: 'TENCENT_CLOUD_MODEL_LIST',
      },
      volcengine: {
        withDeploymentName: true,
      },
      volcenginecodingplan: {
        withDeploymentName: true,
      },
    }),
    defaultAgent: {
      config: parseAgentConfig(DEFAULT_AGENT_CONFIG),
    },
    enableBusinessFeatures: ENABLE_BUSINESS_FEATURES,
    enableKlavis: !!klavisEnv.KLAVIS_API_KEY,
    enableLobehubSkill: !!(appEnv.MARKET_TRUSTED_CLIENT_SECRET && appEnv.MARKET_TRUSTED_CLIENT_ID),
    enableMarketTrustedClient: !!(
      appEnv.MARKET_TRUSTED_CLIENT_SECRET && appEnv.MARKET_TRUSTED_CLIENT_ID
    ),
    enableUploadFileToServer: !!fileEnv.S3_SECRET_ACCESS_KEY,
    enableVisualUnderstanding: !!(
      toolsEnv.VISUAL_UNDERSTANDING_PROVIDER && toolsEnv.VISUAL_UNDERSTANDING_MODEL
    ),
    ...(toolsEnv.VISUAL_UNDERSTANDING_PROVIDER && toolsEnv.VISUAL_UNDERSTANDING_MODEL
      ? {
          visualUnderstanding: {
            model: toolsEnv.VISUAL_UNDERSTANDING_MODEL,
            provider: toolsEnv.VISUAL_UNDERSTANDING_PROVIDER,
          },
        }
      : undefined),

    commercial,
    billing: {
      trialCredits: TRIAL_CREDITS,
    },
    // Expose Agent Gateway URL to client (used by hetero agents; also required for queue mode)
    ...(appEnv.AGENT_GATEWAY_URL ? { agentGatewayUrl: appEnv.AGENT_GATEWAY_URL } : undefined),

    image: cleanObject({
      defaultImageNum: imageEnv.AI_IMAGE_DEFAULT_IMAGE_NUM,
    }),
    memory: {
      userMemory: cleanObject(getPublicMemoryExtractionConfig()),
    },
    oAuthSSOProviders: getBetterAuthSSOProviders(),
    platformProviderStatus: getPlatformProviderStatus(llmConfig),
    systemAgent: parseSystemAgent(appEnv.SYSTEM_AGENT),
    telemetry: {
      langfuse: langfuseEnv.ENABLE_LANGFUSE,
    },
  };

  return config;
}

export const getServerDefaultAgentConfig = () => {
  const { DEFAULT_AGENT_CONFIG } = getAppConfig();

  return parseAgentConfig(DEFAULT_AGENT_CONFIG) || {};
};

export const getServerDefaultFilesConfig = () => {
  return parseFilesConfig(knowledgeEnv.DEFAULT_FILES_CONFIG);
};
