import { describe, expect, it } from 'vitest';

import ctaBannerSource from '../components/CTABanner.tsx?raw';
import { APP_SCENARIOS } from '../const';

describe('Explore design assets', () => {
  it('uses design image assets for every scenario card', () => {
    expect(APP_SCENARIOS).toHaveLength(6);

    for (const scenario of APP_SCENARIOS) {
      const { image } = scenario as { image?: string };

      expect(image).toMatch(/^\/images\/explore\/scenario-.+\.png$/);
    }
  });

  it('centers CTA content on compact screens to avoid an empty right side', () => {
    expect(ctaBannerSource).toContain('@media (max-width: 768px)');
    expect(ctaBannerSource).toContain('align-items: center;');
    expect(ctaBannerSource).toContain('text-align: center;');
    expect(ctaBannerSource).toContain('max-width: 520px;');
  });
});
