import { describe, expect, it } from 'vitest';

import sideBarHeaderLayoutSource from './SideBarHeaderLayout.tsx?raw';

describe('SideBarHeaderLayout', () => {
  it('uses the workspace root for default home navigation', () => {
    expect(sideBarHeaderLayoutSource).toContain("backTo = '/home'");
    expect(sideBarHeaderLayoutSource).toContain("href: '/home'");
  });
});
