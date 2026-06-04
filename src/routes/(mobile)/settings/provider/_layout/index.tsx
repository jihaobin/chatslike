'use client';

import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';

import { userModelProviderSettingsAdapter } from '@/business/shared/adapters';
import { isSuperAdminRole } from '@/const/authRoles';
import { aiProviderSelectors, useAiInfraStore } from '@/store/aiInfra';
import { serverConfigSelectors, useServerConfigStore } from '@/store/serverConfig';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/slices/auth/selectors';

import { ProviderNoAccess } from '../../../../(main)/settings/provider';
import ProviderMenu from '../../../../(main)/settings/provider/ProviderMenu';

const Layout = () => {
  const params = useParams<{ providerId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const isGlobalScope = location.pathname.startsWith('/settings/provider/global/');
  const commercial = useServerConfigStore(serverConfigSelectors.commercial);
  const isSuperAdmin = useUserStore((s) => isSuperAdminRole(userProfileSelectors.userProfile(s)?.role));
  const targetScope = isGlobalScope && isSuperAdmin ? 'global' : 'user';
  const shouldBlockUserSettings =
    !isSuperAdmin && !userModelProviderSettingsAdapter.canUseUserProviderSettings(commercial);
  const activeScope = useAiInfraStore(aiProviderSelectors.activeProviderConfigScope);
  const setActiveProviderConfigScope = useAiInfraStore((s) => s.setActiveProviderConfigScope);

  useEffect(() => {
    if (activeScope !== targetScope) setActiveProviderConfigScope(targetScope);
  }, [activeScope, setActiveProviderConfigScope, targetScope]);

  const handleProviderSelect = (providerKey: string) => {
    navigate(`/settings/provider/${targetScope === 'global' ? 'global/' : ''}${providerKey}`);
  };

  if ((isGlobalScope && !isSuperAdmin) || shouldBlockUserSettings) return <ProviderNoAccess />;
  if (activeScope !== targetScope) return null;

  return params.providerId === 'all' ? (
    <ProviderMenu mobile={true} onProviderSelect={handleProviderSelect} />
  ) : (
    <Outlet />
  );
};

export default Layout;
