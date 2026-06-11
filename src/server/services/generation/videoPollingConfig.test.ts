import { describe, expect, it } from 'vitest';

import {
  VIDEO_GENERATION_MAX_RETRIES,
  VIDEO_GENERATION_POLLING_INTERVAL,
  VIDEO_GENERATION_TASK_TIMEOUT,
} from './videoPollingConfig';

describe('videoPollingConfig', () => {
  it('sets video generation polling timeout to 60 minutes', () => {
    expect(VIDEO_GENERATION_POLLING_INTERVAL).toBe(5000);
    expect(VIDEO_GENERATION_TASK_TIMEOUT).toBe(60 * 60 * 1000);
    expect(VIDEO_GENERATION_MAX_RETRIES).toBe(720);
  });
});
