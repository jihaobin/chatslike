import { describe, expect, it } from 'vitest';

import {
  GLOBAL_PROVIDER_CONFIG_USER_ID,
  ProviderConfigScope,
  isGlobalProviderScope,
} from '../constants';
import { getProviderConfigScopeUserId } from '../permissions';

describe('global provider scope helpers', () => {
  it('detects global scope', () => {
    expect(isGlobalProviderScope(ProviderConfigScope.Global)).toBe(true);
    expect(isGlobalProviderScope(ProviderConfigScope.User)).toBe(false);
    expect(isGlobalProviderScope()).toBe(false);
  });

  it('resolves scope owner user id', () => {
    expect(
      getProviderConfigScopeUserId({ requestedScope: ProviderConfigScope.Global, userId: 'user-1' }),
    ).toBe(GLOBAL_PROVIDER_CONFIG_USER_ID);
    expect(
      getProviderConfigScopeUserId({ requestedScope: ProviderConfigScope.User, userId: 'user-1' }),
    ).toBe('user-1');
    expect(getProviderConfigScopeUserId({ userId: 'user-1' })).toBe('user-1');
  });

});
