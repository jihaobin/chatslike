/**
 * @vitest-environment happy-dom
 */
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import AssistantMessage from './index';

const displayMessage = {
  agentId: 'agent-1',
  content: 'partial answer before failure',
  createdAt: new Date(),
  error: {
    body: { message: 'Model failed' },
    message: 'Model failed',
    type: 'AgentRuntimeError',
  },
  id: 'assistant-1',
  role: 'assistant',
};

vi.mock('@lobechat/const', () => ({
  LOADING_FLAT: '...',
}));

vi.mock('@/const/messageActionPortal', () => ({
  MESSAGE_ACTION_BAR_PORTAL_ATTRIBUTES: { assistant: 'data-assistant-action' },
}));

vi.mock('@/features/Conversation/ChatItem', () => ({
  ChatItem: ({
    children,
    customErrorRender,
    error,
  }: {
    children?: ReactNode;
    customErrorRender?: (error: { message?: string }) => ReactNode;
    error?: { message?: string };
  }) => (
    <div>
      {children}
      {error && <div data-testid="assistant-error">{customErrorRender?.(error)}</div>}
    </div>
  ),
}));

vi.mock('@/store/user', () => ({
  useUserStore: (selector: (state: unknown) => unknown) => selector({}),
}));

vi.mock('@/store/user/selectors', () => ({
  userGeneralSettingsSelectors: {
    config: () => ({ isDevMode: false }),
  },
}));

vi.mock('../../Error', () => ({
  default: ({ data }: { data: { error?: { message?: string } } }) => (
    <div>{data.error?.message}</div>
  ),
  useErrorContent: (error?: { message?: string }) => (error ? { message: error.message } : undefined),
}));

vi.mock('../../hooks', () => ({
  useAgentMeta: () => ({ title: 'Agent' }),
  useDoubleClickEdit: () => vi.fn(),
}));

vi.mock('../../store', () => ({
  dataSelectors: {
    getDisplayMessageById: () => () => displayMessage,
  },
  messageStateSelectors: {
    isMessageCreating: () => () => false,
    isMessageEditing: () => () => false,
    isMessageGenerating: () => () => false,
    isMessageInterrupted: () => () => false,
  },
  useConversationStore: (selector: (state: unknown) => unknown) => selector({}),
}));

vi.mock('../../utils/markdown', () => ({
  normalizeThinkTags: (content: string) => content,
  processWithArtifact: (content: string) => content,
}));

vi.mock('../components/MessageBranch', () => ({
  default: () => <div>branch</div>,
}));

vi.mock('../Contexts/message-action-context', () => ({
  useSetMessageItemActionElementPortialContext: () => vi.fn(),
  useSetMessageItemActionTypeContext: () => vi.fn(),
}));

vi.mock('./components/InterruptedHint', () => ({
  default: () => <div>interrupted</div>,
}));

vi.mock('./components/MessageContent', () => ({
  default: ({ content }: { content: string }) => <div>{content}</div>,
}));

vi.mock('./Extra', () => ({
  AssistantMessageExtra: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

describe('AssistantMessage', () => {
  it('renders error UI even when failed message has partial content', () => {
    render(<AssistantMessage id="assistant-1" index={0} />);

    expect(screen.getByText('partial answer before failure')).toBeInTheDocument();
    expect(screen.getByTestId('assistant-error')).toHaveTextContent('Model failed');
  });
});
