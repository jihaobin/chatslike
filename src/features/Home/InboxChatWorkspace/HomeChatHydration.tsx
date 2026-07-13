'use client';

import { useUnmount } from 'ahooks';
import { memo, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { useAgentStore } from '@/store/agent';
import { builtinAgentSelectors } from '@/store/agent/selectors';
import { useChatStore } from '@/store/chat';

interface BuildHomeChatUrlParams {
  hash: string;
  searchParams: URLSearchParams;
  threadId?: string | null | undefined;
  topicId: string | null | undefined;
}

const buildHomeChatUrl = (params: BuildHomeChatUrlParams) => {
  const { hash, searchParams, threadId, topicId } = params;
  const hasThreadId = 'threadId' in params;
  const nextSearchParams = new URLSearchParams(searchParams);

  if (topicId) {
    nextSearchParams.set('topic', topicId);
    if (hasThreadId) {
      if (threadId) {
        nextSearchParams.set('thread', threadId);
      } else {
        nextSearchParams.delete('thread');
      }
    }
  } else {
    nextSearchParams.delete('topic');
    nextSearchParams.delete('thread');
  }

  const search = nextSearchParams.toString();

  return `/home${search ? `?${search}` : ''}${hash}`;
};

const HomeChatHydration = memo(() => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inboxAgentId = useAgentStore(builtinAgentSelectors.inboxAgentId);

  const locationRef = useRef(location);
  const searchParamsRef = useRef(searchParams);

  locationRef.current = location;
  searchParamsRef.current = searchParams;

  const routeTopicId = searchParams.get('topic');
  const routeThreadId = searchParams.get('thread');

  useLayoutEffect(() => {
    if (!inboxAgentId) return;

    useAgentStore.setState({ activeAgentId: inboxAgentId }, false, 'HomeChatHydration/syncAgentId');
    useChatStore.setState(
      { activeAgentId: inboxAgentId },
      false,
      'HomeChatHydration/syncChatAgentId',
    );
  }, [inboxAgentId]);

  useLayoutEffect(() => {
    const target = routeTopicId ?? undefined;
    if (useChatStore.getState().activeTopicId !== target) {
      useChatStore.setState({ activeTopicId: target }, false, 'HomeChatHydration/syncTopic');
    }
  }, [routeTopicId]);

  useLayoutEffect(() => {
    const target = routeThreadId ?? undefined;
    if (useChatStore.getState().activeThreadId !== target) {
      useChatStore.setState({ activeThreadId: target }, false, 'HomeChatHydration/syncThread');
    }
  }, [routeThreadId]);

  useLayoutEffect(() => {
    const unsubscribeTopic = useChatStore.subscribe(
      (s) => s.activeTopicId,
      (topicId) => {
        const nextUrl = buildHomeChatUrl({
          hash: locationRef.current.hash,
          searchParams: searchParamsRef.current,
          topicId,
        });
        const currentUrl = `${locationRef.current.pathname}${locationRef.current.search}${locationRef.current.hash}`;

        if (currentUrl !== nextUrl) {
          navigate(nextUrl, { replace: true });
        }
      },
    );
    const unsubscribeThread = useChatStore.subscribe(
      (s) => s.activeThreadId,
      (threadId) => {
        const topicId = useChatStore.getState().activeTopicId ?? searchParamsRef.current.get('topic');
        const nextUrl = buildHomeChatUrl({
          hash: locationRef.current.hash,
          searchParams: searchParamsRef.current,
          threadId,
          topicId,
        });
        const currentUrl = `${locationRef.current.pathname}${locationRef.current.search}${locationRef.current.hash}`;

        if (currentUrl !== nextUrl) {
          navigate(nextUrl, { replace: true });
        }
      },
    );

    return () => {
      unsubscribeTopic();
      unsubscribeThread();
    };
  }, [navigate]);

  useUnmount(() => {
    useAgentStore.setState(
      { activeAgentId: undefined },
      false,
      'HomeChatHydration/unmountAgentId',
    );
    useChatStore.setState(
      { activeAgentId: undefined, activeThreadId: undefined, activeTopicId: undefined },
      false,
      'HomeChatHydration/unmountAgentId',
    );
  });

  return null;
});

HomeChatHydration.displayName = 'HomeChatHydration';

export default HomeChatHydration;
