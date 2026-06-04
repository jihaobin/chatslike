import type * as businessConstModule from '@lobechat/business-const';
import { HeterogeneousAgentSessionErrorCode } from '@lobechat/electron-client-ipc';
import type * as modelRuntimeModule from '@lobechat/model-runtime';
import type { ChatMessageError } from '@lobechat/types';
import type * as lobechatTypesModule from '@lobechat/types';
import type * as lobehubUiModule from '@lobehub/ui';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import ErrorMessageExtra from './index';

const navigateMock = vi.fn();
let enableBusinessFeaturesMock = true;
let displayMessagesMock: Array<{ id: string; role: string }> = [];

const phoneVerificationError: ChatMessageError = {
  body: { code: 'PHONE_VERIFICATION_REQUIRED' },
  message: 'Phone verification is required',
  type: 'PHONE_VERIFICATION_REQUIRED',
};

vi.mock('@lobechat/business-const', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof businessConstModule;

  return {
    ...actual,
    ENABLE_BUSINESS_FEATURES: false,
  };
});

vi.mock('@lobechat/model-runtime', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof modelRuntimeModule;

  return {
    ...actual,
    AgentRuntimeErrorType: {
      ...actual.AgentRuntimeErrorType,
      AgentRuntimeError: 'AgentRuntimeError',
    },
  };
});

vi.mock('@lobechat/types', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof lobechatTypesModule;

  return {
    ...actual,
    ChatErrorType: {
      ...actual.ChatErrorType,
      SystemTimeNotMatchError: 'SystemTimeNotMatchError',
    },
  };
});

vi.mock('@lobehub/ui', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof lobehubUiModule;

  return {
    ...actual,
    Block: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Highlighter: ({ children }: { children?: ReactNode }) => <pre>{children}</pre>,
    Skeleton: {
      ...actual.Skeleton,
      Button: () => <div>loading</div>,
    },
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('@/business/client/hooks/useBusinessErrorAlertConfig', () => ({
  default: () => undefined,
}));

vi.mock('@/business/client/hooks/useBusinessErrorContent', () => ({
  default: () => ({ errorType: undefined, hideMessage: false }),
}));

vi.mock('@/business/client/hooks/useRenderBusinessChatErrorMessageExtra', () => ({
  default: (error?: { type?: string }) =>
    error?.type === 'PHONE_VERIFICATION_REQUIRED' ? <div>phone verification guide</div> : undefined,
}));

vi.mock('@/features/Conversation/ChatItem/components/ErrorContent', () => ({
  default: ({ error }: { error?: { extra?: ReactNode; message?: string } }) => (
    <div>
      <div>{error?.message}</div>
      {error?.extra}
    </div>
  ),
}));

vi.mock('@/features/Electron/HeterogeneousAgent/StatusGuide', () => ({
  default: ({ agentType, error }: { agentType?: string; error?: { code?: string } }) => (
    <div>{`guide:${agentType}:${error?.code}`}</div>
  ),
}));

vi.mock('@/hooks/useProviderName', () => ({
  useProviderName: () => 'Mock Provider',
}));

vi.mock('@/libs/next/dynamic', () => ({
  default: () => () => <div>dynamic</div>,
}));

vi.mock('@/store/serverConfig', () => ({
  serverConfigSelectors: {
    enableBusinessFeatures: (s: { enableBusinessFeatures?: boolean }) =>
      s.enableBusinessFeatures ?? false,
  },
  useServerConfigStore: (selector: (s: { enableBusinessFeatures?: boolean }) => unknown) =>
    selector({ enableBusinessFeatures: enableBusinessFeaturesMock }),
}));

vi.mock('@/features/Conversation/store', () => ({
  useConversationStore: (selector: (state: unknown) => unknown) =>
    selector({
      deleteMessage: vi.fn(),
      displayMessages: displayMessagesMock,
      regenerateAssistantMessage: vi.fn(),
    }),
}));

describe('ErrorMessageExtra', () => {
  beforeEach(() => {
    enableBusinessFeaturesMock = true;
    displayMessagesMock = [];
  });

  it('renders the auth guide when the refreshed error is missing type but still carries session code', () => {
    render(
      <ErrorMessageExtra
        error={{ message: 'response.undefined' }}
        data={{
          error: {
            body: {
              agentType: 'claude-code',
              code: HeterogeneousAgentSessionErrorCode.AuthRequired,
              message: 'Failed to authenticate',
            },
            message: 'Failed to authenticate',
          } as any,
          id: 'msg-auth',
        }}
      />,
    );

    expect(screen.getByText('guide:claude-code:auth_required')).toBeInTheDocument();
  });

  it('renders the rate-limit guide when the refreshed error carries rate_limit code', () => {
    render(
      <ErrorMessageExtra
        error={{ message: 'response.undefined' }}
        data={{
          error: {
            body: {
              agentType: 'claude-code',
              code: HeterogeneousAgentSessionErrorCode.RateLimit,
              message: "You've hit your limit · resets 9am (Asia/Shanghai)",
            },
            message: "You've hit your limit · resets 9am (Asia/Shanghai)",
          } as any,
          id: 'msg-rate-limit',
        }}
      />,
    );

    expect(screen.getByText('guide:claude-code:rate_limit')).toBeInTheDocument();
  });

  it('renders the heterogeneous guide from the session body without relying on the top-level error type', () => {
    render(
      <ErrorMessageExtra
        error={{ message: 'response.ServerAgentRuntimeError' }}
        data={{
          error: {
            body: {
              agentType: 'claude-code',
              clearEchoedContent: true,
              code: HeterogeneousAgentSessionErrorCode.RateLimit,
              message: "You've hit your limit · resets May 17 at 2am (Asia/Shanghai)",
              rateLimitInfo: {
                isUsingOverage: false,
                overageDisabledReason: 'org_level_disabled',
                overageStatus: 'rejected',
                rateLimitType: 'seven_day',
                resetsAt: 1778954400,
                status: 'rejected',
              },
              stderr: "You've hit your limit · resets May 17 at 2am (Asia/Shanghai)",
            },
            message: "You've hit your limit · resets May 17 at 2am (Asia/Shanghai)",
            type: 'ServerAgentRuntimeError',
          } as any,
          id: 'msg-rate-limit-wrapped',
        }}
      />,
    );

    expect(screen.getByText('guide:claude-code:rate_limit')).toBeInTheDocument();
  });

  it('falls back to the raw error message instead of rendering a blank block', () => {
    render(
      <ErrorMessageExtra
        error={{ message: 'response.undefined' }}
        data={{
          error: {
            body: { detail: 'raw detail' },
            message: 'Raw runtime error',
          } as any,
          id: 'msg-raw',
        }}
      />,
    );

    expect(screen.getByText('Raw runtime error')).toBeInTheDocument();
    expect(screen.getByText(/"detail": "raw detail"/)).toBeInTheDocument();
  });

  it('renders business phone verification guide when the request is blocked by phone verification', () => {
    render(
      <ErrorMessageExtra
        error={{ message: 'response.PHONE_VERIFICATION_REQUIRED' }}
        data={{
          error: phoneVerificationError,
          id: 'msg-phone-verification',
        }}
      />,
    );

    expect(screen.getByText('phone verification guide')).toBeInTheDocument();
  });

  it('renders phone verification guide even when server business feature flag is off', () => {
    enableBusinessFeaturesMock = false;

    render(
      <ErrorMessageExtra
        error={{ message: 'response.PHONE_VERIFICATION_REQUIRED' }}
        data={{
          error: phoneVerificationError,
          id: 'msg-phone-verification-with-flag-off',
        }}
      />,
    );

    expect(screen.getByText('phone verification guide')).toBeInTheDocument();
  });

  it('hides stale business guide after the user sends a later message', () => {
    displayMessagesMock = [
      { id: 'msg-phone-verification', role: 'assistant' },
      { id: 'msg-after-verification', role: 'user' },
    ];

    render(
      <ErrorMessageExtra
        error={{ message: 'response.PHONE_VERIFICATION_REQUIRED' }}
        data={{
          error: phoneVerificationError,
          id: 'msg-phone-verification',
        }}
      />,
    );

    expect(screen.queryByText('phone verification guide')).not.toBeInTheDocument();
    expect(screen.queryByText('Phone verification is required')).not.toBeInTheDocument();
  });
});
