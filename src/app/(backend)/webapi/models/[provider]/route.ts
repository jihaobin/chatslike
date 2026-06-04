import { type ChatCompletionErrorPayload } from '@lobechat/model-runtime';
import { ChatErrorType } from '@lobechat/types';
import { TRPCError } from '@trpc/server';
import { NextResponse } from 'next/server';

import { checkAuth } from '@/app/(backend)/middleware/auth';
import { ProviderConfigScope } from '@/business/server/globalProviderScope/constants';
import {
  assertGlobalProviderScopeReadable,
  getProviderConfigScopeUserId,
} from '@/business/server/globalProviderScope/permissions';
import { initModelRuntimeFromDB } from '@/server/modules/ModelRuntime';
import { createErrorResponse } from '@/utils/errorResponse';

export const GET = checkAuth(async (req, { params, userId, serverDB }) => {
  const provider = (await params)!.provider!;
  const scope = new URL(req.url).searchParams.get('scope') === 'global' ? ProviderConfigScope.Global : undefined;

  try {
    await assertGlobalProviderScopeReadable({ db: serverDB, selector: { scope }, userId });

    // Read user's provider config from database
    const agentRuntime = await initModelRuntimeFromDB(
      serverDB,
      getProviderConfigScopeUserId({ requestedScope: scope, userId }),
      provider,
    );

    const list = await agentRuntime.models();

    return NextResponse.json(list);
  } catch (e) {
    if (e instanceof TRPCError) {
      return NextResponse.json({ error: e.message }, { status: e.code === 'FORBIDDEN' ? 403 : 500 });
    }

    const {
      errorType = ChatErrorType.InternalServerError,
      error: errorContent,
      ...res
    } = e as ChatCompletionErrorPayload;

    const error = errorContent || e;
    // track the error at server side
    console.error(`Route: [${provider}] ${errorType}:`, error);

    // Sanitize error to avoid exposing stack traces to users
    const sanitizedError =
      error instanceof Error ? { message: error.message, name: error.name } : error;

    return createErrorResponse(errorType, { error: sanitizedError, ...res, provider });
  }
});
