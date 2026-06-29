import { describe, expect, it } from 'vitest';

import { nextjsOnlyRoutes } from './nextjsOnlyRoutes';

describe('nextjsOnlyRoutes', () => {
  it('does not include the removed email verification page route', () => {
    const removedRoute = ['/verify', 'email'].join('-');

    expect(nextjsOnlyRoutes).not.toContain(removedRoute);
  });

  it('does not include removed email login routes', () => {
    expect(nextjsOnlyRoutes).not.toContain('/signup');
    expect(nextjsOnlyRoutes).not.toContain('/reset-password');
  });
});
