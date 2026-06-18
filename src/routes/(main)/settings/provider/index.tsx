'use client';

import { Center, Flexbox, Text } from '@lobehub/ui';
import type { ReactNode } from 'react';
import { memo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';

import { userModelProviderSettingsAdapter } from '@/business/shared/adapters';
import { isSuperAdminRole } from '@/const/authRoles';
import { isCustomBranding } from '@/const/version';
import { aiProviderSelectors, useAiInfraStore } from '@/store/aiInfra';
import {
  featureFlagsSelectors,
  serverConfigSelectors,
  useServerConfigStore,
} from '@/store/serverConfig';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/slices/auth/selectors';

import DesktopLayoutContainer from './_layout/Desktop/Container';
import Footer from './(list)/Footer';
import ProviderDetailPageComponent from './detail';
import ProviderScopeBanner from './features/ProviderScopeBanner';
import ProviderMenu from './ProviderMenu';
import ProviderRedirectComponent from './ProviderRedirect';

type ProviderConfigScope = 'user' | 'global';

interface ProviderScopeGateProps {
  children: ReactNode;
  scope?: ProviderConfigScope;
}

export const ProviderNoAccess = memo(() => {
  const { t } = useTranslation('modelProvider');

  return (
    <Center height={'100%'} padding={24} width={'100%'}>
      <Flexbox align={'center'} gap={8} style={{ maxWidth: 420, textAlign: 'center' }}>
        <Text strong>{t('providerScope.noAccess.title')}</Text>
        <Text style={{ opacity: 0.66 }}>{t('providerScope.noAccess.desc')}</Text>
      </Flexbox>
    </Center>
  );
});

ProviderNoAccess.displayName = 'ProviderNoAccess';

const ProviderScopeGate = memo<ProviderScopeGateProps>(({ children, scope = 'user' }) => {
  const commercial = useServerConfigStore(serverConfigSelectors.commercial);
  const userRole = useUserStore((s) => userProfileSelectors.userProfile(s)?.role);
  const isSuperAdmin = isSuperAdminRole(userRole);
  const activeScope = useAiInfraStore(aiProviderSelectors.activeProviderConfigScope);
  const setActiveProviderConfigScope = useAiInfraStore((s) => s.setActiveProviderConfigScope);
  const isGlobalRequest = scope === 'global';
  const targetScope = scope === 'global' && isSuperAdmin ? 'global' : 'user';
  const shouldBlockUserSettings =
    !isSuperAdmin && !userModelProviderSettingsAdapter.canUseUserProviderSettings(commercial);

  useEffect(() => {
    if (activeScope !== targetScope) setActiveProviderConfigScope(targetScope);
  }, [activeScope, setActiveProviderConfigScope, targetScope]);

  if ((isGlobalRequest && !isSuperAdmin) || shouldBlockUserSettings) return <ProviderNoAccess />;
  if (activeScope !== targetScope) return null;

  return children;
});

ProviderScopeGate.displayName = 'ProviderScopeGate';

// Layout component that wraps provider pages with navigation
export const ProviderLayout = memo<{ scope?: ProviderConfigScope }>(({ scope }) => {
  const navigate = useNavigate();
  const hideProviderTemplates = useServerConfigStore(featureFlagsSelectors)?.hideProviderTemplates;

  const handleProviderSelect = (providerKey: string) => {
    navigate(`/settings/provider/${scope === 'global' ? 'global/' : ''}${providerKey}`);
  };

  return (
    <ProviderScopeGate scope={scope}>
      <Flexbox
        horizontal
        width={'100%'}
        style={{
          maxHeight: '100%',
        }}
      >
        {!hideProviderTemplates && (
          <ProviderMenu mobile={false} onProviderSelect={handleProviderSelect} />
        )}
        <DesktopLayoutContainer>
          <ProviderScopeBanner />
          <Outlet />
          {!isCustomBranding && <Footer />}
        </DesktopLayoutContainer>
      </Flexbox>
    </ProviderScopeGate>
  );
});

ProviderLayout.displayName = 'ProviderLayout';

export const ProviderGlobalLayout = memo(() => <ProviderLayout scope="global" />);

ProviderGlobalLayout.displayName = 'ProviderGlobalLayout';

// Smart landing element for the provider index route (user scope)
export const ProviderRedirect = memo(() => <ProviderRedirectComponent scope="user" />);

ProviderRedirect.displayName = 'ProviderRedirect';

// Smart landing element for the provider index route (global scope)
export const ProviderGlobalRedirect = memo(() => <ProviderRedirectComponent scope="global" />);

ProviderGlobalRedirect.displayName = 'ProviderGlobalRedirect';

// Detail page component that receives providerId from route params
export const ProviderDetailPage = memo(() => {
  const params = useParams<{ providerId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const isGlobalScope = location.pathname.startsWith('/settings/provider/global/');

  const handleProviderSelect = (providerKey: string) => {
    navigate(`/settings/provider/${isGlobalScope ? 'global/' : ''}${providerKey}`);
  };

  return (
    <ProviderDetailPageComponent
      id={params.providerId ?? ''}
      onProviderSelect={handleProviderSelect}
    />
  );
});

ProviderDetailPage.displayName = 'ProviderDetailPage';

// Default export for backward compatibility (used by SettingsContent)
type ProviderPageType = {
  mobile?: boolean;
};

const ProviderPage = (props: ProviderPageType) => {
  const { mobile } = props;

  return (
    <ProviderScopeGate>
      <ProviderPageContent mobile={mobile} />
    </ProviderScopeGate>
  );
};

const ProviderPageContent = (props: ProviderPageType) => {
  // For mobile or when used via SettingsContent, use the old Page component.
  const OldPage = require('./(list)').default;
  return <OldPage mobile={props.mobile} />;
};

export default ProviderPage;
