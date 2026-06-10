import { AUTH_REQUIRED_HEADER } from '@lobechat/desktop-bridge';
import { type ILobeAgentRuntimeErrorType } from '@lobechat/model-runtime';
import { AgentRuntimeErrorType } from '@lobechat/model-runtime';
import { type ErrorType } from '@lobechat/types';
import { ChatErrorType } from '@lobechat/types';

import type { PlatformProviderErrorCode } from '@/business/shared/platformProviderErrors';
import { isPlatformProviderErrorCode } from '@/business/shared/platformProviderErrors';

/**
 * Error types that indicate a real authentication failure.
 * When these errors occur, the response will include X-Auth-Required header
 * to signal the client that re-authentication is needed.
 */
const AUTH_REQUIRED_ERROR_TYPES = new Set<ErrorType>([ChatErrorType.Unauthorized]);
const FALLBACK_STATUS_CODE = 500;

type LobeErrorResponseType = ILobeAgentRuntimeErrorType | ErrorType | PlatformProviderErrorCode;

interface LobeErrorResponse {
  body: unknown;
  errorType: LobeErrorResponseType;
}

const getStatus = (errorType: LobeErrorResponseType) => {
  // InvalidAccessCode / InvalidAzureAPIKey / InvalidOpenAIAPIKey / InvalidZhipuAPIKey ....
  if (errorType.toString().includes('Invalid')) return 401;

  if (isPlatformProviderErrorCode(errorType)) return 403;

  switch (errorType) {
    case ChatErrorType.InsufficientCredits: {
      return 402;
    }

    case ChatErrorType.SubscriptionPlanLimit:
    case ChatErrorType.FreePlanLimit:
    case ChatErrorType.InsufficientBudgetForModel:
    case ChatErrorType.PhoneVerificationRequired: {
      return 403;
    }

    // TODO: Need to refactor to Invalid OpenAI API Key
    case AgentRuntimeErrorType.InvalidProviderAPIKey:
    case AgentRuntimeErrorType.NoOpenAIAPIKey: {
      return 401;
    }

    case AgentRuntimeErrorType.ExceededContextWindow:
    case AgentRuntimeErrorType.ExceededToolLimit:
    case ChatErrorType.SubscriptionKeyMismatch:
    case ChatErrorType.SystemTimeNotMatchError:
    case ChatErrorType.LobeHubModelDeprecated: {
      return 400;
    }

    case AgentRuntimeErrorType.LocationNotSupportError: {
      return 403;
    }

    case AgentRuntimeErrorType.ModelNotFound: {
      return 404;
    }

    case AgentRuntimeErrorType.AccountDeactivated: {
      return 403;
    }

    case AgentRuntimeErrorType.InsufficientQuota:
    case AgentRuntimeErrorType.QuotaLimitReached: {
      return 429;
    }

    // define the 471~480 as provider error
    case AgentRuntimeErrorType.AgentRuntimeError: {
      return 470;
    }

    case AgentRuntimeErrorType.ProviderBizError: {
      return 471;
    }

    // all local provider connection error
    case AgentRuntimeErrorType.OllamaServiceUnavailable:
    case ChatErrorType.OllamaServiceUnavailable:
    case AgentRuntimeErrorType.OllamaBizError: {
      return 472;
    }
  }

  return errorType as number;
};

const resolveResponseStatus = (statusCode: unknown) => {
  if (typeof statusCode === 'number' && statusCode >= 200 && statusCode <= 599) return statusCode;

  console.error(
    `current StatusCode: \`${statusCode}\` .`,
    'Please go to `./src/app/api/errorResponse.ts` to defined the statusCode.',
  );

  return FALLBACK_STATUS_CODE;
};

export const createErrorResponse = (
  errorType: LobeErrorResponseType,
  body?: any,
) => {
  const statusCode = resolveResponseStatus(getStatus(errorType));

  const data: LobeErrorResponse = { body, errorType };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add X-Auth-Required header for real authentication failures
  // This allows the client to distinguish between auth failures and other 401 errors (e.g., invalid API keys)
  if (AUTH_REQUIRED_ERROR_TYPES.has(errorType as ErrorType)) {
    headers[AUTH_REQUIRED_HEADER] = 'true';
  }

  return new Response(JSON.stringify(data), { headers, status: statusCode });
};
