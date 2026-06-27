import { describe, expect, it } from 'vitest';

import notFoundSource from '../../components/404/index.tsx?raw';
import errorSource from '../../components/Error/index.tsx?raw';
import adminGuardSource from '../../features/Admin/_layout/AdminGuard.tsx?raw';
import adminSidebarSource from '../../features/Admin/_layout/AdminSidebar.tsx?raw';
import desktopOnboardingSource from '../../routes/(desktop)/desktop-onboarding/index.tsx?raw';
import agentManagementGuardSource from '../../routes/(main)/guards/AgentManagementGuard.tsx?raw';
import routerSource from '../../utils/router.tsx?raw';

describe('workspace home navigation targets', () => {
  it('redirects blocked workspace routes back to the workspace root', () => {
    expect(adminGuardSource).toContain('<Navigate replace to="/home" />');
    expect(agentManagementGuardSource).toContain('<Navigate replace to="/home" />');
  });

  it('enters the workspace after desktop onboarding is complete', () => {
    expect(desktopOnboardingSource).toContain("window.location.replace('/home')");
  });

  it('uses the workspace root for app-level error and not-found recovery', () => {
    expect(errorSource).toContain("resetPath = '/home'");
    expect(notFoundSource).toContain("backHomePath = '/home'");
    expect(routerSource).toContain("pathname === '/'");
    expect(routerSource).toContain("pathname.startsWith('/explore')");
    expect(routerSource).toContain('resetPath ?? defaultResetPath');
  });

  it('keeps admin navigation inside the settings workspace route', () => {
    expect(adminSidebarSource).toContain("path: '/home/settings/admin'");
    expect(adminSidebarSource).toContain('to="/home/settings/admin/audit"');
  });
});
