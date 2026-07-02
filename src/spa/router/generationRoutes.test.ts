import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

async function readRouteSource(route: 'image' | 'video') {
  return readFile(
    path.join(process.cwd(), `src/routes/(main)/(create)/${route}/index.tsx`),
    'utf8',
  );
}

async function readSource(relativePath: string) {
  return readFile(path.join(process.cwd(), relativePath), 'utf8');
}

describe('generation route pages', () => {
  it('matches image and video pages under the workspace /home route', async () => {
    const [imageSource, videoSource] = await Promise.all([
      readRouteSource('image'),
      readRouteSource('video'),
    ]);

    expect(imageSource).toContain('path="/home/image"');
    expect(videoSource).toContain('path="/home/video"');
  });

  it('keeps generation entry navigation on workspace routes', async () => {
    const [
      exploreSource,
      mediaModeSource,
      imageLayoutSource,
      videoLayoutSource,
      starterListSource,
    ] = await Promise.all([
      readSource('src/features/Explore/useExploreNavigate.ts'),
      readSource(
        'src/routes/(main)/(create)/features/GenerationInput/GenerationMediaModeSegment.tsx',
      ),
      readSource('src/routes/(main)/(create)/image/_layout/index.tsx'),
      readSource('src/routes/(main)/(create)/video/_layout/index.tsx'),
      readSource('src/routes/(main)/home/features/InputArea/StarterList.tsx'),
    ]);

    expect(exploreSource).toContain('`/home/image?model=${model}`');
    expect(exploreSource).toContain('`/home/video?model=${model}`');
    expect(mediaModeSource).toContain(
      "navigate(value === 'video' ? '/home/video' : '/home/image')",
    );
    expect(imageLayoutSource).toContain("href: '/home/image'");
    expect(videoLayoutSource).toContain("href: '/home/video'");
    expect(starterListSource).toContain(
      "navigate('/home/video?model=dreamina-seedance-2-0-260128')",
    );
    expect(starterListSource).toContain("navigate('/home/image?model=gpt-image-2')");
  });

  it('shows a visible loading state while generation chunks are resolving', async () => {
    const routerUtilsSource = await readSource('src/utils/router.tsx');

    expect(routerUtilsSource).toContain("debugId={debugId || 'dynamicElement'}");
    expect(routerUtilsSource).toContain("debugId={debugId || 'dynamicLayout'}");
    expect(routerUtilsSource).not.toContain('fallback={null}');
  });
});
