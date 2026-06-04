// @vitest-environment node
import { type LobeRuntimeAI } from '@lobechat/model-runtime';
import { ModelRuntime } from '@lobechat/model-runtime';
import { ChatErrorType } from '@lobechat/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { auth } from '@/auth';
import { GLOBAL_PROVIDER_CONFIG_USER_ID } from '@/business/server/globalProviderScope/constants';
import { GLOBAL_PROVIDER_SCOPE_FORBIDDEN } from '@/business/server/globalProviderScope/permissions';
import { getServerDB } from '@/database/core/db-adaptor';
import { initModelRuntimeFromDB } from '@/server/modules/ModelRuntime';

import { GET } from './route';

type TestSession = Awaited<ReturnType<typeof auth.api.getSession>>;

vi.mock('@/app/(backend)/middleware/auth/utils', () => ({
  checkAuthMethod: vi.fn(),
}));

vi.mock('@/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn().mockResolvedValue(null),
    },
  },
}));

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn(),
}));

vi.mock('@/server/modules/ModelRuntime', () => ({
  initModelRuntimeFromDB: vi.fn(),
}));

let request: Request;

const mockDb = {
  select: vi.fn(),
};

const mockRoleLookup = (role?: string) => {
  const query = {
    from: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(role ? [{ role }] : []),
    where: vi.fn().mockReturnThis(),
  };
  mockDb.select.mockReturnValue(query);
};

beforeEach(() => {
  request = new Request(new URL('https://test.com'), {
    method: 'GET',
  });

  // Default: valid session
  const testSession = {
    session: {},
    user: { id: 'test-user-id' },
  } as unknown as TestSession;
  vi.mocked(auth.api.getSession).mockResolvedValue(testSession);
  vi.mocked(getServerDB).mockResolvedValue(mockDb as never);
  mockRoleLookup('user');
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('GET handler', () => {
  describe('error handling', () => {
    it('should not expose stack trace when an Error is thrown', async () => {
      const mockParams = Promise.resolve({ provider: 'google' });

      const errorWithStack = new Error('Something went wrong');
      errorWithStack.stack =
        'Error: Something went wrong\n    at Object.<anonymous> (/path/to/file.ts:10:15)';

      const mockRuntime: LobeRuntimeAI = {
        baseURL: 'abc',
        chat: vi.fn(),
        models: vi.fn().mockRejectedValue(errorWithStack),
      };
      vi.mocked(initModelRuntimeFromDB).mockResolvedValue(new ModelRuntime(mockRuntime));

      const response = await GET(request, { params: mockParams });
      const responseBody = await response.json();

      expect(responseBody.body.error.name).toBe('Error');
      expect(responseBody.body.error.message).toBe('Something went wrong');
      expect(responseBody.body.error.stack).toBeUndefined();

      const responseText = JSON.stringify(responseBody);
      expect(responseText).not.toContain('/path/to/file.ts');
      expect(responseText).not.toContain('at Object');
    });

    it('should preserve error name for custom error types', async () => {
      const mockParams = Promise.resolve({ provider: 'google' });

      class CustomError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'CustomError';
        }
      }

      const customError = new CustomError('Custom error occurred');
      customError.stack = 'CustomError: Custom error occurred\n    at somewhere';

      const mockRuntime: LobeRuntimeAI = {
        baseURL: 'abc',
        chat: vi.fn(),
        models: vi.fn().mockRejectedValue(customError),
      };
      vi.mocked(initModelRuntimeFromDB).mockResolvedValue(new ModelRuntime(mockRuntime));

      const response = await GET(request, { params: mockParams });
      const responseBody = await response.json();

      expect(responseBody.body.error.name).toBe('CustomError');
      expect(responseBody.body.error.message).toBe('Custom error occurred');
      expect(responseBody.body.error.stack).toBeUndefined();
    });

    it('should pass through structured error objects as-is', async () => {
      const mockParams = Promise.resolve({ provider: 'google' });

      const structuredError = {
        errorType: ChatErrorType.InternalServerError,
        error: { code: 'PROVIDER_ERROR', details: 'API limit exceeded' },
      };

      const mockRuntime: LobeRuntimeAI = {
        baseURL: 'abc',
        chat: vi.fn(),
        models: vi.fn().mockRejectedValue(structuredError),
      };
      vi.mocked(initModelRuntimeFromDB).mockResolvedValue(new ModelRuntime(mockRuntime));

      const response = await GET(request, { params: mockParams });
      const responseBody = await response.json();

      expect(responseBody.body.error.code).toBe('PROVIDER_ERROR');
      expect(responseBody.body.error.details).toBe('API limit exceeded');
    });

    it('should return correct status code for errors', async () => {
      const mockParams = Promise.resolve({ provider: 'google' });

      const mockRuntime: LobeRuntimeAI = {
        baseURL: 'abc',
        chat: vi.fn(),
        models: vi.fn().mockRejectedValue(new Error('Failed')),
      };
      vi.mocked(initModelRuntimeFromDB).mockResolvedValue(new ModelRuntime(mockRuntime));

      const response = await GET(request, { params: mockParams });

      expect(response.status).toBe(500);
    });

    it('should include provider in error response', async () => {
      const mockParams = Promise.resolve({ provider: 'openai' });

      const mockRuntime: LobeRuntimeAI = {
        baseURL: 'abc',
        chat: vi.fn(),
        models: vi.fn().mockRejectedValue(new Error('Failed')),
      };
      vi.mocked(initModelRuntimeFromDB).mockResolvedValue(new ModelRuntime(mockRuntime));

      const response = await GET(request, { params: mockParams });
      const responseBody = await response.json();

      expect(responseBody.body.provider).toBe('openai');
    });
  });

  describe('success cases', () => {
    it('should return model list on success', async () => {
      const mockParams = Promise.resolve({ provider: 'openai' });

      const mockModelList = [
        { id: 'gpt-4', name: 'GPT-4' },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
      ];

      const mockRuntime: LobeRuntimeAI = {
        baseURL: 'abc',
        chat: vi.fn(),
        models: vi.fn().mockResolvedValue(mockModelList),
      };
      vi.mocked(initModelRuntimeFromDB).mockResolvedValue(new ModelRuntime(mockRuntime));

      const response = await GET(request, { params: mockParams });
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody).toEqual(mockModelList);
    });

    it('uses the global provider config user when a super admin requests global scope', async () => {
      const mockParams = Promise.resolve({ provider: 'openai' });
      request = new Request(new URL('https://test.com?scope=global'), { method: 'GET' });
      mockRoleLookup('super-admin');

      const mockRuntime: LobeRuntimeAI = {
        baseURL: 'abc',
        chat: vi.fn(),
        models: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(initModelRuntimeFromDB).mockResolvedValue(new ModelRuntime(mockRuntime));

      const response = await GET(request, { params: mockParams });

      expect(response.status).toBe(200);
      expect(initModelRuntimeFromDB).toHaveBeenCalledWith(
        mockDb,
        GLOBAL_PROVIDER_CONFIG_USER_ID,
        'openai',
      );
    });

    it('rejects global scope model fetches for ordinary users before runtime initialization', async () => {
      const mockParams = Promise.resolve({ provider: 'openai' });
      request = new Request(new URL('https://test.com?scope=global'), { method: 'GET' });
      mockRoleLookup('user');

      const response = await GET(request, { params: mockParams });
      const responseBody = await response.json();

      expect(response.status).toBe(403);
      expect(JSON.stringify(responseBody)).toContain(GLOBAL_PROVIDER_SCOPE_FORBIDDEN);
      expect(initModelRuntimeFromDB).not.toHaveBeenCalled();
    });
  });
});
