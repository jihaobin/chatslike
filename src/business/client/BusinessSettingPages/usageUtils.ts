export const getUsageDurationMs = (metadata?: Record<string, unknown> | null) => {
  if (!metadata) return;

  for (const key of ['durationMs', 'elapsedMs', 'latency', 'duration']) {
    const value = metadata[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  }
};

export const formatUsageDuration = (durationMs?: number) => {
  if (durationMs === undefined) return '-';

  return `${(durationMs / 1000).toFixed(2)}s`;
};

export const getUsageTotalTokens = (inputTokens?: number | null, outputTokens?: number | null) =>
  (inputTokens ?? 0) + (outputTokens ?? 0);
