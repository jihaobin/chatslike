import { describe, expect, it } from 'vitest';

import notFoundSource from '../../components/404/index.tsx?raw';
import errorSource from '../../components/Error/index.tsx?raw';
import safeBoundarySource from '../../components/ErrorBoundary/index.tsx?raw';
import routeErrorBoundarySource from '../../components/Error/RouteErrorBoundary.tsx?raw';
import circleLoadingSource from '../../components/Loading/CircleLoading/index.tsx?raw';
import adminGuardSource from '../../features/Admin/_layout/AdminGuard.tsx?raw';
import adminSidebarSource from '../../features/Admin/_layout/AdminSidebar.tsx?raw';
import spaGlobalProviderSource from '../../layout/SPAGlobalProvider/index.tsx?raw';
import appThemeSource from '../../layout/GlobalProvider/AppTheme.tsx?raw';
import serverVersionOutdatedAlertSource from '../../layout/GlobalProvider/ServerVersionOutdatedAlert.tsx?raw';
import settingsCategorySource from '../../routes/(main)/settings/hooks/useCategory.tsx?raw';
import desktopOnboardingSource from '../../routes/(desktop)/desktop-onboarding/index.tsx?raw';
import agentManagementGuardSource from '../../routes/(main)/guards/AgentManagementGuard.tsx?raw';
import homeModelIconSource from '../../routes/(main)/home/_layout/Header/components/HomeModelIcon.tsx?raw';
import homeInputAreaSource from '../../routes/(main)/home/features/InputArea/index.tsx?raw';
import globalStyleSource from '../../styles/global.ts?raw';
import chunkErrorSource from '../../utils/chunkError.ts?raw';
import routerSource from '../../utils/router.tsx?raw';
import messagePublicApiSource from '../../store/chat/slices/message/actions/publicApi.ts?raw';
import businessErrorContentSource from '../../business/client/hooks/useBusinessErrorContent.tsx?raw';
import businessErrorAlertConfigSource from '../../business/client/hooks/useBusinessErrorAlertConfig.ts?raw';
import brandTextLoadingSource from '../../components/Loading/BrandTextLoading/index.tsx?raw';
import builtinRenderDisplayControlsSource from '../../../packages/builtin-tools/src/displayControls.ts?raw';
import builtinInspectorsSource from '../../../packages/builtin-tools/src/inspectors.ts?raw';
import builtinInterventionsSource from '../../../packages/builtin-tools/src/interventions.ts?raw';
import builtinRendersSource from '../../../packages/builtin-tools/src/renders.ts?raw';
import webOnboardingExecutorSource from '../../store/tool/slices/builtin/executors/lobe-web-onboarding.ts?raw';

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

  it('keeps the heavy route error screen out of the router bootstrap chunk', () => {
    expect(routerSource).not.toContain("import { ThemeProvider } from '@lobehub/ui'");
    expect(routerSource).not.toContain("import ErrorCapture from '@/components/Error'");
    expect(routerSource).toContain("lazy(() => import('@/components/Error/RouteErrorBoundary'))");
  });

  it('keeps SPA bootstrap providers off the root lobe-ui barrel', () => {
    const bootstrapSources = [
      ['AppTheme', appThemeSource],
      ['BrandTextLoading', brandTextLoadingSource],
      ['businessErrorAlertConfig', businessErrorAlertConfigSource],
      ['businessErrorContent', businessErrorContentSource],
      ['CircleLoading', circleLoadingSource],
      ['ErrorCapture', errorSource],
      ['RouteErrorBoundary', routeErrorBoundarySource],
      ['SafeBoundary', safeBoundarySource],
      ['SPAGlobalProvider', spaGlobalProviderSource],
      ['ServerVersionOutdatedAlert', serverVersionOutdatedAlertSource],
      ['globalStyle', globalStyleSource],
      ['chunkError', chunkErrorSource],
      ['messagePublicApi', messagePublicApiSource],
    ];

    for (const [name, source] of bootstrapSources) {
      expect(source, name).not.toContain("from '@lobehub/ui'");
      expect(source, name).not.toContain('from "@lobehub/ui"');
      expect(source, name).not.toContain("import('@lobehub/ui')");
      expect(source, name).not.toContain('import("@lobehub/ui")');
    }
  });

  it('keeps the route suspense loader off the lobe-ui brand barrel', () => {
    expect(brandTextLoadingSource).not.toContain("from '@lobehub/ui/brand'");
    expect(brandTextLoadingSource).not.toContain('from "@lobehub/ui/brand"');
    expect(brandTextLoadingSource).toContain("from '@lobehub/ui/es/brand/BrandLoading/index'");
    expect(brandTextLoadingSource).toContain("from '@lobehub/ui/es/brand/LobeHubText/index'");
  });

  it('loads the rich home chat input only after user interaction', () => {
    expect(homeInputAreaSource).not.toContain("from '@/features/ChatInput'");
    expect(homeInputAreaSource).not.toContain('from "@/features/ChatInput"');
    expect(homeInputAreaSource).toContain("import('@/features/ChatInput')");
  });

  it('keeps root icon barrels out of the workspace home header', () => {
    expect(homeModelIconSource).not.toContain("from '@lobehub/icons'");
    expect(homeModelIconSource).not.toContain('from "@lobehub/icons"');
  });

  it('keeps bootstrap route metadata off the lobe-ui icons barrel', () => {
    expect(settingsCategorySource).not.toContain("from '@lobehub/ui/icons'");
    expect(settingsCategorySource).not.toContain('from "@lobehub/ui/icons"');
    expect(settingsCategorySource).toContain(
      "from '@lobehub/ui/es/icons/lucideExtra/SkillsIcon'",
    );
  });

  it('keeps builtin tool UI registries lazy', () => {
    const builtinUiRegistrySources = [
      ['displayControls', builtinRenderDisplayControlsSource],
      ['inspectors', builtinInspectorsSource],
      ['interventions', builtinInterventionsSource],
      ['renders', builtinRendersSource],
    ];

    for (const [name, source] of builtinUiRegistrySources) {
      expect(source, name).not.toMatch(/from ['"]@lobechat\/builtin-tool-[^'"]+\/client['"]/);
    }

    expect(builtinRenderDisplayControlsSource).not.toMatch(
      /from ['"]@lobechat\/builtin-tool-[^'"]+\/client['"]/,
    );
    expect(builtinRendersSource).not.toContain("from '@lobechat/shared-tool-ui/renders'");
    expect(builtinRendersSource).not.toContain('from "@lobechat/shared-tool-ui/renders"');
    expect(builtinInspectorsSource).not.toContain("from '@lobechat/shared-tool-ui/inspectors'");
    expect(builtinInspectorsSource).not.toContain('from "@lobechat/shared-tool-ui/inspectors"');
  });

  it('keeps the web onboarding marketplace runtime out of the store bootstrap chunk', () => {
    expect(webOnboardingExecutorSource).not.toContain(
      "from '@lobechat/builtin-tool-web-onboarding/agentMarketplace'",
    );
    expect(webOnboardingExecutorSource).not.toContain(
      'from "@lobechat/builtin-tool-web-onboarding/agentMarketplace"',
    );
    expect(webOnboardingExecutorSource).toContain(
      "import('@lobechat/builtin-tool-web-onboarding/agentMarketplace/runtime')",
    );
  });

  it('keeps admin navigation inside the settings workspace route', () => {
    expect(adminSidebarSource).toContain("path: '/home/settings/admin'");
    expect(adminSidebarSource).toContain('to="/home/settings/admin/audit"');
  });
});
