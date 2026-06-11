import { describe, expect, it, vi } from 'vitest';

import { UsageRecordModel } from '../billing/usageRecord';

describe('UsageRecordModel', () => {
  it('normalizes legacy video token usage from metadata when listing records', async () => {
    const createdAt = new Date('2024-06-11T14:42:00Z');
    const orderBy = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([
      {
        actualCredits: 21_775,
        businessId: 'batch-1',
        createdAt,
        estimatedCredits: 1,
        id: 'usage-video-1',
        inputTokens: null,
        metadata: { usage: { completionTokens: 500_000, totalTokens: 1_500_000 } },
        modality: 'video',
        model: 'doubao-seedance-2.0-fast',
        outputTokens: null,
        overrunCredits: 0,
        params: {},
        provider: 'volcengine',
        providerRequestId: null,
        releasedCredits: 0,
        reservationId: 'reservation-1',
        status: 'captured',
        userId: 'user-1',
      },
    ]) });
    const where = vi.fn().mockReturnValue({ orderBy });
    const from = vi.fn().mockReturnValue({ where });
    const db = { select: vi.fn().mockReturnValue({ from }) };
    const model = new UsageRecordModel(db as never, 'user-1');

    const result = await model.list({ pageSize: 20 });

    expect(result.items[0]).toMatchObject({
      id: 'usage-video-1',
      inputTokens: 1_000_000,
      outputTokens: 500_000,
    });
  });
});
