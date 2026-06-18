import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('mobileRouter task routes', () => {
  it('registers mobile global provider detail routes emitted by super-admin settings nav', async () => {
    const source = await readFile(
      path.join(process.cwd(), 'src/spa/router/mobileRouter.config.tsx'),
      'utf8',
    );

    expect(source).toContain("path: 'global/:providerId'");
    expect(source).toContain('Mobile > Settings > Provider > Global Detail');
  });
});
