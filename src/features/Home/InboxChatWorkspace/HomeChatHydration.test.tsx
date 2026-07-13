/**
 * @vitest-environment happy-dom
 */
import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { initialState as initialChatState } from '@/store/chat/initialState';
import { useChatStore } from '@/store/chat/store';

import HomeChatHydration from './HomeChatHydration';

const navigateMock = vi.hoisted(() => vi.fn());
const useLocationMock = vi.hoisted(() => vi.fn());
const useSearchParamsMock = vi.hoisted(() => vi.fn());

const agentState = vi.hoisted(() => ({
  inboxAgentId: 'agt_inbox',
}));

vi.mock('react-router-dom', async () => {
  const actual = (await vi.importActual('react-router-dom')) as typeof import('react-router-dom');

  return {
    ...actual,
    useLocation: useLocationMock,
    useNavigate: () => navigateMock,
    useSearchParams: useSearchParamsMock,
  };
});

vi.mock('@/store/agent', () => ({
  useAgentStore: Object.assign(
    (selector: (state: typeof agentState) => unknown) => selector(agentState),
    {
      setState: vi.fn((partial: Partial<typeof agentState>) => Object.assign(agentState, partial)),
    },
  ),
}));

vi.mock('@/store/agent/selectors', () => ({
  builtinAgentSelectors: {
    inboxAgentId: (state: typeof agentState) => state.inboxAgentId,
  },
}));

describe('HomeChatHydration', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    useLocationMock.mockReset();
    useSearchParamsMock.mockReset();

    useChatStore.setState(
      {
        ...initialChatState,
        activeAgentId: undefined,
        activeThreadId: undefined,
        activeTopicId: undefined,
      },
      false,
    );
  });

  it('hydrates inbox agent, topic, and thread from /home query params', async () => {
    useLocationMock.mockReturnValue({
      hash: '#msg_1',
      pathname: '/home',
      search: '?topic=tpc_123&thread=thd_456',
    });
    useSearchParamsMock.mockReturnValue([new URLSearchParams('topic=tpc_123&thread=thd_456')]);

    render(<HomeChatHydration />);

    await waitFor(() => {
      expect(useChatStore.getState().activeAgentId).toBe('agt_inbox');
      expect(useChatStore.getState().activeTopicId).toBe('tpc_123');
      expect(useChatStore.getState().activeThreadId).toBe('thd_456');
      expect(navigateMock).not.toHaveBeenCalled();
    });
  });

  it('rewrites /home query params when active topic changes', async () => {
    useLocationMock.mockReturnValue({
      hash: '',
      pathname: '/home',
      search: '?topic=tpc_123&thread=thd_456',
    });
    useSearchParamsMock.mockReturnValue([new URLSearchParams('topic=tpc_123&thread=thd_456')]);

    render(<HomeChatHydration />);

    navigateMock.mockClear();

    await act(async () => {
      useChatStore.setState({ activeTopicId: 'tpc_789' }, false);
    });

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/home?topic=tpc_789&thread=thd_456', {
        replace: true,
      });
    });
  });

  it('returns to plain /home when active topic is cleared', async () => {
    useLocationMock.mockReturnValue({
      hash: '',
      pathname: '/home',
      search: '?topic=tpc_123&thread=thd_456',
    });
    useSearchParamsMock.mockReturnValue([new URLSearchParams('topic=tpc_123&thread=thd_456')]);

    render(<HomeChatHydration />);

    navigateMock.mockClear();

    await act(async () => {
      useChatStore.setState({ activeThreadId: undefined, activeTopicId: undefined }, false);
    });

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/home', { replace: true });
    });
  });

  it('rewrites /home query params when active thread changes', async () => {
    useLocationMock.mockReturnValue({
      hash: '',
      pathname: '/home',
      search: '?topic=tpc_123&thread=thd_456',
    });
    useSearchParamsMock.mockReturnValue([new URLSearchParams('topic=tpc_123&thread=thd_456')]);

    render(<HomeChatHydration />);

    navigateMock.mockClear();

    await act(async () => {
      useChatStore.setState({ activeThreadId: 'thd_789' }, false);
    });

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/home?topic=tpc_123&thread=thd_789', {
        replace: true,
      });
    });
  });
});
