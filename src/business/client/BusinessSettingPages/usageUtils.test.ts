import { describe, expect, it } from 'vitest';

import { formatUsageDuration, getUsageDurationMs, getUsageTotalTokens } from './usageUtils';

describe('usageUtils', () => {
  it('formats usage duration from known metadata keys', () => {
    expect(getUsageDurationMs({ durationMs: 13_460 })).toBe(13_460);
    expect(getUsageDurationMs({ elapsedMs: 3000 })).toBe(3000);
    expect(getUsageDurationMs({ latency: 216_030 })).toBe(216_030);
    expect(formatUsageDuration(13_460)).toBe('13.46s');
  });

  it('falls back when duration metadata is unavailable', () => {
    expect(getUsageDurationMs({ durationMs: -1 })).toBeUndefined();
    expect(getUsageDurationMs({ durationMs: '13s' })).toBeUndefined();
    expect(formatUsageDuration()).toBe('-');
  });

  it('sums input and output tokens with null-safe defaults', () => {
    expect(getUsageTotalTokens(43_123, 1115)).toBe(44_238);
    expect(getUsageTotalTokens(null, 5488)).toBe(5488);
  });
});
