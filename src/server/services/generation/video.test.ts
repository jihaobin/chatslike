import { describe, expect, it } from 'vitest';

import { resolveFfmpegPath } from './video';

describe('resolveFfmpegPath', () => {
  it('uses FFMPEG_PATH before bundled or PATH ffmpeg', () => {
    expect(resolveFfmpegPath('/bundled/ffmpeg', '/custom/ffmpeg')).toBe('/custom/ffmpeg');
  });

  it('uses the bundled ffmpeg-static binary before PATH ffmpeg', () => {
    expect(resolveFfmpegPath('/bundled/ffmpeg')).toBe('/bundled/ffmpeg');
  });

  it('falls back to PATH ffmpeg when no bundled binary is available', () => {
    expect(resolveFfmpegPath(null)).toBe('ffmpeg');
  });
});
