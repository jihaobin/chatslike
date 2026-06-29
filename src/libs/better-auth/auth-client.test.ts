import { describe, expect, it } from 'vitest';

import desktopAuthClientSource from './auth-client.desktop.ts?raw';
import authClientSource from './auth-client.ts?raw';

describe('better-auth client exports', () => {
  it('does not expose removed email sign-up and password reset helpers', () => {
    for (const source of [authClientSource, desktopAuthClientSource]) {
      expect(source).not.toContain('changeEmail');
      expect(source).not.toContain('requestPasswordReset');
      expect(source).not.toContain('resetPassword');
      expect(source).not.toContain('signUp');
    }
  });
});
