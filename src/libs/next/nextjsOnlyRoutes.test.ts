import { describe, expect, it } from 'vitest';

import { nextjsOnlyRoutes } from './nextjsOnlyRoutes';

describe('nextjsOnlyRoutes', () => {
  it('does not include the removed email verification page route', () => {
    const removedRoute = ['/verify', 'email'].join('-');

    expect(nextjsOnlyRoutes).not.toContain(removedRoute);
  });
});
