// @vitest-environment node
import type {
  ChatCompletionErrorPayload,
  ChatStreamPayload,
  OnFinishData,
} from '@lobechat/model-runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getBusinessModelRuntimeHooks } from '@/business/server/model-runtime';

const {
  assertPrechargeRisk,
  captureUsageCredits,
  createUsageRecord,
  getTextPricing,
  mockDb,
  releaseUsageCredits,
  reserveUsageCredits,
} = vi.hoisted(() => ({
  assertPrechargeRisk: vi.fn(),
  captureUsageCredits: vi.fn(),
  createUsageRecord: vi.fn(),
  getTextPricing: vi.fn(),
  mockDb: {},
  releaseUsageCredits: vi.fn(),
  reserveUsageCredits: vi.fn(),
}));

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn(async () => mockDb),
}));

vi.mock('@/business/server/billing/credits', () => ({
  CreditsService: vi.fn().mockImplementation(() => ({
    captureUsageCredits,
    createUsageRecord,
    releaseUsageCredits,
    reserveUsageCredits,
  })),
}));

vi.mock('@/business/server/billing/risk', () => ({
  assertPrechargeRisk,
}));

vi.mock('@/business/server/billing/pricing', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  getTextPricing,
}));

const payload = {
  messages: [{ content: 'hello', role: 'user' }],
  model: 'gpt-4.1',
  provider: 'openai',
} satisfies ChatStreamPayload;

describe('getBusinessModelRuntimeHooks', () => {
  beforeEach(() => {
    assertPrechargeRisk.mockReset();
    assertPrechargeRisk.mockResolvedValue(undefined);
    captureUsageCredits.mockReset();
    createUsageRecord.mockReset();
    getTextPricing.mockReset();
    getTextPricing.mockResolvedValue({
      inputCreditsPerMillionTokens: 4_000_000,
      outputCreditsPerMillionTokens: 10_000_000,
    });
    releaseUsageCredits.mockReset();
    reserveUsageCredits.mockReset();
    createUsageRecord.mockResolvedValue({ id: 'usage-text-1' });
  });

  it('reserves before chat and captures final usage', async () => {
    reserveUsageCredits.mockResolvedValue({ id: 'reservation-1' });
    const hooks = getBusinessModelRuntimeHooks('user-1', 'openai');

    await hooks?.beforeChat?.(payload);
    await hooks?.onChatFinal?.(
      {
        text: 'hi',
        usage: { inputTextTokens: 1000, outputTextTokens: 500, totalTokens: 1500 },
      } satisfies OnFinishData,
      { payload },
    );

    expect(reserveUsageCredits).toHaveBeenCalledWith(
      expect.objectContaining({
        businessType: 'text',
        model: 'gpt-4.1',
        provider: 'openai',
      }),
    );
    expect(assertPrechargeRisk).toHaveBeenCalledWith({
      db: mockDb,
      estimatedCredits: expect.any(Number),
      userId: 'user-1',
    });
    expect(getTextPricing).toHaveBeenCalledWith({ model: 'gpt-4.1', provider: 'openai' });
    expect(assertPrechargeRisk.mock.invocationCallOrder[0]).toBeLessThan(
      reserveUsageCredits.mock.invocationCallOrder[0],
    );
    expect(captureUsageCredits).toHaveBeenCalledWith(
      expect.objectContaining({
        actualCredits: 9000,
        reservationId: 'reservation-1',
        usageRecordId: 'usage-text-1',
      }),
    );
    expect(createUsageRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        actualCredits: 9000,
        businessId: expect.stringContaining('chat:user-1:openai:gpt-4.1:'),
        inputTokens: 1000,
        modality: 'text',
        model: 'gpt-4.1',
        outputTokens: 500,
        provider: 'openai',
        reservationId: 'reservation-1',
        status: 'captured',
      }),
    );
    expect(createUsageRecord.mock.invocationCallOrder[0]).toBeLessThan(
      captureUsageCredits.mock.invocationCallOrder[0],
    );
    expect(releaseUsageCredits).not.toHaveBeenCalled();
  });

  it('releases the reservation when chat throws', async () => {
    reserveUsageCredits.mockResolvedValue({ id: 'reservation-1' });
    const hooks = getBusinessModelRuntimeHooks('user-1', 'openai');

    await hooks?.beforeChat?.(payload);
    await hooks?.onChatError?.(
      { message: 'provider failed' } as ChatCompletionErrorPayload,
      { payload },
    );

    expect(releaseUsageCredits).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'chat_error',
        reservationId: 'reservation-1',
      }),
    );
    expect(captureUsageCredits).not.toHaveBeenCalled();
  });
});
