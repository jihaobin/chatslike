import { describe, expect, it } from 'vitest';

import { __testing, sharedModulePreload } from './sharedRendererConfig';

describe('sharedResolveDedupe', () => {
  it('keeps UI and motion contexts singleton across peer dependency instances', () => {
    expect(__testing.sharedResolveDedupe).toEqual(
      expect.arrayContaining([
        '@lobehub/ui',
        '@lobehub/ui/base-ui',
        '@lobehub/ui/icons',
        'motion',
        'react',
        'react-dom',
        'react/jsx-runtime',
      ]),
    );
  });
});

describe('sharedModulePreload', () => {
  it('keeps vendor modulepreload dependencies while excluding i18n chunks', () => {
    const resolveDependencies = sharedModulePreload.resolveDependencies!;

    expect(
      resolveDependencies(
        'assets/index.js',
        [
          'assets/vendor-icons.js',
          'vendor/vendor-react.js',
          'i18n/i18n-default.js',
          'assets/i18n-en-US.js',
          'assets/page.js',
        ],
        { hostId: 'index.html', hostType: 'html' },
      ),
    ).toEqual(['assets/vendor-icons.js', 'vendor/vendor-react.js', 'assets/page.js']);
  });

  it('keeps app chunks out of entry html preloads while preserving runtime dynamic preloads', () => {
    const resolveDependencies = sharedModulePreload.resolveDependencies!;
    const deps = [
      'assets/app-routes.js',
      'assets/app-feature-admin.js',
      'assets/app-store.js',
      'assets/app-services.js',
      'vendor/vendor-react.js',
      'assets/explore.js',
    ];

    expect(
      resolveDependencies('assets/index.js', deps, { hostId: 'index.html', hostType: 'html' }),
    ).toEqual(['vendor/vendor-react.js', 'assets/explore.js']);
    expect(
      resolveDependencies('assets/explore.js', deps, {
        hostId: 'assets/explore.js',
        hostType: 'js',
      }),
    ).toEqual(deps);
  });
});

describe('sharedManualChunks', () => {
  it('groups stable runtime packages into coarse vendor chunks', () => {
    expect(
      __testing.sharedManualChunks('/repo/node_modules/.pnpm/react@19/node_modules/react/index.js'),
    ).toBe('vendor-react');
    expect(
      __testing.sharedManualChunks(
        '/repo/node_modules/.pnpm/react-dom@19/node_modules/react-dom/client.js',
      ),
    ).toBe('vendor-react');
    expect(
      __testing.sharedManualChunks(
        '/repo/node_modules/.pnpm/@emotion+react/node_modules/@emotion/react/dist/index.js',
      ),
    ).toBe('vendor-ui-runtime');
    expect(
      __testing.sharedManualChunks(
        '/repo/node_modules/.pnpm/motion@12/node_modules/motion/react/dist/index.js',
      ),
    ).toBe('vendor-ui-runtime');
    expect(
      __testing.sharedManualChunks(
        '/repo/node_modules/.pnpm/lucide-react/node_modules/lucide-react/dist/index.js',
      ),
    ).toBe('vendor-icons');
    expect(
      __testing.sharedManualChunks(
        '/repo/node_modules/.pnpm/zustand@5/node_modules/zustand/esm/index.mjs',
      ),
    ).toBe('vendor-data-runtime');
    expect(
      __testing.sharedManualChunks('/repo/packages/model-runtime/src/providers/openai/index.ts'),
    ).toBe('vendor-ai-runtime');
    expect(
      __testing.sharedManualChunks(
        '/repo/node_modules/.pnpm/openai@4/node_modules/openai/index.mjs',
      ),
    ).toBe('vendor-ai-runtime');
  });
});

describe('app module chunk names', () => {
  it('keeps route modules in route-owned chunks instead of one app-routes bundle', () => {
    expect(__testing.getAppModuleChunkName('/repo/src/routes/(main)/agent/index.tsx')).toBeNull();
    expect(
      __testing.getAppModuleChunkName('/repo/src/routes/(main)/settings/index.tsx'),
    ).toBeNull();
  });

  it('keeps feature modules in importer-owned chunks to avoid entry chunk pollution', () => {
    expect(__testing.getAppModuleChunkName('/repo/src/features/Explore/index.tsx')).toBeNull();
    expect(__testing.getAppModuleChunkName('/repo/src/features/AgentBuilder/index.tsx')).toBeNull();
    expect(__testing.getAppModuleChunkName('/repo/src/features/CommandMenu/index.tsx')).toBeNull();
  });

  it('keeps store and service modules in importer-owned chunks to avoid entry chunk pollution', () => {
    expect(__testing.getAppModuleChunkName('/repo/src/store/user/index.ts')).toBeNull();
    expect(__testing.getAppModuleChunkName('/repo/src/services/user.ts')).toBeNull();
    expect(__testing.getAppModuleChunkName('/repo/src/components/App.tsx')).toBeNull();
  });
});
