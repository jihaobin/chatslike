import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const readDesktopFile = (name: string) =>
  readFileSync(new URL(`../../../../../${name}`, import.meta.url), 'utf8');

describe('desktop startup HTML', () => {
  it.each(['index.html', 'popup.html'])(
    'does not inline the LobeHub loading screen in %s',
    (file) => {
      const html = readDesktopFile(file);

      expect(html).not.toContain('id="loading-screen"');
      expect(html).not.toContain('id="loading-brand"');
    },
  );
});
