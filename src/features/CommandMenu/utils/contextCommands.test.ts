import { describe, expect, it } from 'vitest';

import { buildContextCommands } from './contextCommands';

const getSettingsSubPaths = (options: {
  nativeBillingEnabled: boolean;
  referralEnabled: boolean;
}) => buildContextCommands(options).settings.map((command) => command.subPath);

describe('buildContextCommands', () => {
  it('adds native billing settings commands when native billing is enabled', () => {
    const subPaths = getSettingsSubPaths({
      nativeBillingEnabled: true,
      referralEnabled: false,
    });

    expect(subPaths).toEqual(expect.arrayContaining(['plans', 'credits', 'usage', 'billing']));
    expect(subPaths).not.toContain('referral');
  });

  it('adds referral command without adding native billing commands', () => {
    const subPaths = getSettingsSubPaths({
      nativeBillingEnabled: false,
      referralEnabled: true,
    });

    expect(subPaths).toContain('referral');
    expect(subPaths).not.toContain('plans');
    expect(subPaths).not.toContain('credits');
    expect(subPaths).not.toContain('usage');
    expect(subPaths).not.toContain('billing');
  });

  it('adds referral command when native referral is enabled without cloud integration', () => {
    const subPaths = getSettingsSubPaths({
      nativeBillingEnabled: false,
      referralEnabled: true,
    });

    expect(subPaths).toContain('referral');
  });
});
