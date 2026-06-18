import { describe, expect, it, vi } from 'vitest';

import { componentMap as webMap } from './componentMap';
import { componentMap as desktopMap } from './componentMap.desktop';

const { EmptyComponent } = vi.hoisted(() => ({
  EmptyComponent: () => null,
}));

vi.mock('@/components/Loading/BrandTextLoading', () => ({
  default: EmptyComponent,
}));

vi.mock('@/libs/next/dynamic', () => ({
  default: () => EmptyComponent,
}));

vi.mock('@/business/client/BusinessSettingPages/AdminBilling', () => ({
  default: EmptyComponent,
}));

vi.mock('@/business/client/BusinessSettingPages/Billing', () => ({
  default: EmptyComponent,
}));

vi.mock('@/business/client/BusinessSettingPages/Credits', () => ({
  default: EmptyComponent,
}));

vi.mock('@/business/client/BusinessSettingPages/Notification', () => ({
  default: EmptyComponent,
}));

vi.mock('@/business/client/BusinessSettingPages/Plans', () => ({
  default: EmptyComponent,
}));

vi.mock('@/business/client/BusinessSettingPages/Referral', () => ({
  default: EmptyComponent,
}));

vi.mock('@/business/client/BusinessSettingPages/Usage', () => ({
  default: EmptyComponent,
}));

vi.mock('../about', () => ({
  default: EmptyComponent,
}));

vi.mock('../apikey', () => ({
  default: EmptyComponent,
}));

vi.mock('../creds', () => ({
  default: EmptyComponent,
}));

vi.mock('../messenger', () => ({
  default: EmptyComponent,
}));

vi.mock('../profile', () => ({
  default: EmptyComponent,
}));

vi.mock('../provider', () => ({
  default: EmptyComponent,
}));

vi.mock('../proxy', () => ({
  default: EmptyComponent,
}));

vi.mock('../security', () => ({
  default: EmptyComponent,
}));

vi.mock('../service-model', () => ({
  default: EmptyComponent,
}));

vi.mock('../skill', () => ({
  default: EmptyComponent,
}));

vi.mock('../stats', () => ({
  default: EmptyComponent,
}));

vi.mock('../storage', () => ({
  default: EmptyComponent,
}));

vi.mock('../system-tools', () => ({
  default: EmptyComponent,
}));

describe('componentMap desktop sync', () => {
  it('desktop keys must match web keys', () => {
    const webKeys = Object.keys(webMap).sort();
    const desktopKeys = Object.keys(desktopMap).sort();

    const missingInDesktop = webKeys.filter((k) => !desktopKeys.includes(k));
    const extraInDesktop = desktopKeys.filter((k) => !webKeys.includes(k));

    expect(
      missingInDesktop,
      `Missing in componentMap.desktop: ${missingInDesktop.join(', ')}`,
    ).toEqual([]);
    expect(extraInDesktop, `Extra in componentMap.desktop: ${extraInDesktop.join(', ')}`).toEqual(
      [],
    );
  });
});
