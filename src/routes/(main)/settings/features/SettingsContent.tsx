'use client';

import { isDesktop } from '@lobechat/const';
import { Fragment, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  lobeHubCloudAdapter,
  nativeBillingAdapter,
  nativeNotificationAdapter,
  nativeReferralAdapter,
  userModelProviderSettingsAdapter,
} from '@/business/shared/adapters';
import { isSuperAdminRole } from '@/const/authRoles';
import NavHeader from '@/features/NavHeader';
import SettingContainer from '@/features/Setting/SettingContainer';
import { SettingsTabs } from '@/store/global/initialState';
import {
  featureFlagsSelectors,
  serverConfigSelectors,
  useServerConfigStore,
} from '@/store/serverConfig';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/slices/auth/selectors';
import { userGeneralSettingsSelectors } from '@/store/user/slices/settings/selectors';

import { componentMap } from './componentMap';

const REDIRECT_MAP: Record<string, string> = {
  [SettingsTabs.Common]: SettingsTabs.Profile,
  [SettingsTabs.ChatAppearance]: SettingsTabs.Profile,
  // Appearance panel removed; redirect legacy /settings/appearance bookmarks to Profile.
  appearance: SettingsTabs.Profile,
  [SettingsTabs.Agent]: SettingsTabs.ServiceModel,
  [SettingsTabs.TTS]: SettingsTabs.ServiceModel,
  [SettingsTabs.Image]: SettingsTabs.ServiceModel,
};

interface SettingsContentProps {
  activeTab?: string;
  mobile?: boolean;
}

const SettingsContent = ({ mobile, activeTab }: SettingsContentProps) => {
  const { hideDocs, showApiKeyManage, showProvider } = useServerConfigStore(featureFlagsSelectors);
  const commercial = useServerConfigStore(serverConfigSelectors.commercial);
  const nativeBillingEnabled = nativeBillingAdapter.getCapability(commercial).enabled;
  const cloudBusinessEnabled = lobeHubCloudAdapter.getCapability(commercial).enabled;
  const nativeNotificationEnabled = nativeNotificationAdapter.getCapability(commercial).enabled;
  const nativeReferralEnabled = nativeReferralAdapter.getCapability(commercial).enabled;
  const userProviderSettingsEnabled =
    userModelProviderSettingsAdapter.getCapability(commercial).enabled;
  const notificationEnabled = nativeNotificationEnabled || cloudBusinessEnabled;
  const referralEnabled = nativeReferralEnabled || cloudBusinessEnabled;
  const isSuperAdmin = useUserStore((s) =>
    isSuperAdminRole(userProfileSelectors.userProfile(s)?.role),
  );
  const isDevMode = useUserStore((s) => userGeneralSettingsSelectors.config(s).isDevMode);
  const apiKeyEnabled = showApiKeyManage || isDevMode;
  const providerSettingsVisible =
    showProvider &&
    (isSuperAdmin || userModelProviderSettingsAdapter.canUseUserProviderSettings(commercial));
  const navigate = useNavigate();

  useEffect(() => {
    if (activeTab && REDIRECT_MAP[activeTab]) {
      navigate(`/settings/${REDIRECT_MAP[activeTab]}`, { replace: true });
    }
  }, [activeTab, navigate]);

  const renderComponent = (tab: string) => {
    const allowedTabs = [
      ...(userProviderSettingsEnabled ? [SettingsTabs.Creds] : []),
      SettingsTabs.Messenger,
      SettingsTabs.Profile,
      SettingsTabs.Security,
      SettingsTabs.ServiceModel,
      SettingsTabs.Skill,
      SettingsTabs.Stats,
      SettingsTabs.Storage,
      ...(!hideDocs ? [SettingsTabs.About] : []),
      ...(apiKeyEnabled ? [SettingsTabs.APIKey] : []),
      ...(providerSettingsVisible ? [SettingsTabs.Provider] : []),
      ...(isDesktop ? [SettingsTabs.Proxy, SettingsTabs.SystemTools] : []),
      ...(nativeBillingEnabled
        ? [SettingsTabs.Plans, SettingsTabs.Usage, SettingsTabs.Credits, SettingsTabs.Billing]
        : []),
      ...(referralEnabled ? [SettingsTabs.Referral] : []),
      ...(notificationEnabled ? [SettingsTabs.Notification] : []),
    ];

    if (!allowedTabs.includes(tab as SettingsTabs)) return null;

    const Component = componentMap[tab as keyof typeof componentMap] || componentMap.profile;
    if (!Component) return null;

    const componentProps: { mobile?: boolean } = {};
    if (
      [
        SettingsTabs.About,
        ...(apiKeyEnabled ? [SettingsTabs.APIKey] : []),
        SettingsTabs.ServiceModel,
        ...(providerSettingsVisible ? [SettingsTabs.Provider] : []),
        SettingsTabs.Profile,
        SettingsTabs.Stats,
        SettingsTabs.Security,
        ...(notificationEnabled ? [SettingsTabs.Notification] : []),
        ...(nativeBillingEnabled
          ? [SettingsTabs.Plans, SettingsTabs.Usage, SettingsTabs.Credits, SettingsTabs.Billing]
          : []),
        ...(referralEnabled ? [SettingsTabs.Referral] : []),
      ].includes(tab as SettingsTabs)
    ) {
      componentProps.mobile = mobile;
    }

    return <Component {...componentProps} />;
  };

  if (activeTab && REDIRECT_MAP[activeTab]) return null;

  if (mobile) {
    return activeTab ? renderComponent(activeTab) : renderComponent(SettingsTabs.Profile);
  }

  return (
    <>
      {Object.keys(componentMap).map((tabKey) => {
        const isProvider = tabKey === SettingsTabs.Provider;
        if (activeTab !== tabKey) return null;
        const content = renderComponent(tabKey);
        if (isProvider) return <Fragment key={tabKey}>{content}</Fragment>;
        return (
          <Fragment key={tabKey}>
            <NavHeader />
            <SettingContainer maxWidth={1024} paddingBlock={'24px 128px'} paddingInline={24}>
              {content}
            </SettingContainer>
          </Fragment>
        );
      })}
    </>
  );
};

export default SettingsContent;
