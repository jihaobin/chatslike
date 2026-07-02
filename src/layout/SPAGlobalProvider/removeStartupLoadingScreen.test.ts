// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';

import { removeStartupLoadingScreen } from './removeStartupLoadingScreen';

describe('removeStartupLoadingScreen', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('removes a stale startup loading screen after the SPA mounts', () => {
    document.body.innerHTML = '<div id="loading-screen">LobeHub</div><main>Home</main>';

    removeStartupLoadingScreen();

    expect(document.getElementById('loading-screen')).toBeNull();
    expect(document.querySelector('main')?.textContent).toBe('Home');
  });

  it('does nothing when the startup loading screen is absent', () => {
    document.body.innerHTML = '<main>Home</main>';

    expect(() => removeStartupLoadingScreen()).not.toThrow();
    expect(document.querySelector('main')?.textContent).toBe('Home');
  });
});
