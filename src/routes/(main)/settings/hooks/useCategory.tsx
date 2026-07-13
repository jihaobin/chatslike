import { isDesktop } from '@lobechat/const';
import { Avatar } from '@lobehub/ui';
import SkillsIcon from '@lobehub/ui/es/icons/lucideExtra/SkillsIcon';
import {
  BarChart3,
  BellIcon,
  Brain,
  ChartColumnBigIcon,
  Coins,
  CreditCard,
  Database,
  EthernetPort,
  FileText,
  Gift,
  Info,
  KeyIcon,
  KeyRound,
  LayoutDashboard,
  Map,
  MessageCircleIcon,
  ShoppingCart,
  Sparkles,
  TerminalSquare,
  Users,
} from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import {
  lobeHubCloudAdapter,
  nativeBillingAdapter,
  nativeNotificationAdapter,
  nativeReferralAdapter,
  userModelProviderSettingsAdapter,
} from '@/business/shared/adapters';
import { isSuperAdminRole } from '@/const/authRoles';
import { useElectronStore } from '@/store/electron';
import { electronSyncSelectors } from '@/store/electron/selectors';
import { SettingsTabs } from '@/store/global/initialState';
import {
  featureFlagsSelectors,
  serverConfigSelectors,
  useServerConfigStore,
} from '@/store/serverConfig';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/slices/auth/selectors';
import { userGeneralSettingsSelectors } from '@/store/user/slices/settings/selectors';

export enum SettingsGroupKey {
  Admin = 'admin',
  Agent = 'agent',
  General = 'general',
  Subscription = 'subscription',
  System = 'system',
}

export interface CategoryItem {
  exact?: boolean;
  icon: any;
  key: string;
  label: string;
  url?: string;
}

export interface CategoryGroup {
  items: CategoryItem[];
  key: SettingsGroupKey;
  title: string;
}

export const useCategory = () => {
  const { t } = useTranslation('setting');
  const { t: tAuth } = useTranslation('auth');
  const { t: tSubscription } = useTranslation('subscription');
  const { t: tAdmin } = useTranslation('admin');
  const { hideDocs, showApiKeyManage, showProvider } = useServerConfigStore(featureFlagsSelectors);
  const [avatar, username] = useUserStore((s) => [
    userProfileSelectors.userAvatar(s),
    userProfileSelectors.nickName(s),
  ]);
  const remoteServerUrl = useElectronStore(electronSyncSelectors.remoteServerUrl);
  const isDevMode = useUserStore((s) => userGeneralSettingsSelectors.config(s).isDevMode);
  const isSuperAdmin = useUserStore((s) =>
    isSuperAdminRole(userProfileSelectors.userProfile(s)?.role),
  );

  const avatarUrl = useMemo(() => {
    if (!avatar) return undefined;
    if (isDesktop && avatar.startsWith('/') && remoteServerUrl) {
      return remoteServerUrl + avatar;
    }
    return avatar;
  }, [avatar, remoteServerUrl]);
  const commercial = useServerConfigStore(serverConfigSelectors.commercial);
  const nativeBillingEnabled = nativeBillingAdapter.getCapability(commercial).enabled;
  const lobeHubCloudEnabled = lobeHubCloudAdapter.getCapability(commercial).enabled;
  const nativeNotificationEnabled = nativeNotificationAdapter.getCapability(commercial).enabled;
  const nativeReferralEnabled = nativeReferralAdapter.getCapability(commercial).enabled;
  const userProviderSettingsEnabled =
    userModelProviderSettingsAdapter.getCapability(commercial).enabled;
  const notificationEnabled = nativeNotificationEnabled || lobeHubCloudEnabled;
  const referralEnabled = nativeReferralEnabled || lobeHubCloudEnabled;
  const canUseUserProviderSettings =
    userModelProviderSettingsAdapter.canUseUserProviderSettings(commercial);
  const providerSettingsVisible = showProvider && (isSuperAdmin || canUseUserProviderSettings);
  const providerSettingsUrl = isSuperAdmin
    ? '/settings/provider/global/all'
    : '/settings/provider/all';
  const categoryGroups: CategoryGroup[] = useMemo(() => {
    const groups: CategoryGroup[] = [];

    // General group
    const generalItems: CategoryItem[] = [
      {
        icon: avatarUrl ? <Avatar avatar={avatarUrl} shape={'square'} size={26} /> : undefined,
        key: SettingsTabs.Profile,
        label: username || tAuth('tab.profile'),
      },
      {
        icon: ChartColumnBigIcon,
        key: SettingsTabs.Stats,
        label: tAuth('tab.stats'),
      },
      notificationEnabled && {
        icon: BellIcon,
        key: SettingsTabs.Notification,
        label: t('tab.notification'),
      },
    ].filter(Boolean) as CategoryItem[];

    groups.push({
      items: generalItems,
      key: SettingsGroupKey.General,
      title: t('group.common'),
    });

    // Subscription group
    if (nativeBillingEnabled || referralEnabled) {
      const subscriptionItems: CategoryItem[] = [
        nativeBillingEnabled && {
          icon: Map,
          key: SettingsTabs.Plans,
          label: tSubscription('tab.plans'),
        },
        nativeBillingEnabled && {
          icon: ChartColumnBigIcon,
          key: SettingsTabs.Usage,
          label: t('tab.usage'),
        },
        nativeBillingEnabled && {
          icon: Coins,
          key: SettingsTabs.Credits,
          label: tSubscription('tab.credits'),
        },
        nativeBillingEnabled && {
          icon: CreditCard,
          key: SettingsTabs.Billing,
          label: tSubscription('tab.billing'),
        },
        referralEnabled && {
          icon: Gift,
          key: SettingsTabs.Referral,
          label: tSubscription('tab.referral'),
        },
      ].filter(Boolean) as CategoryItem[];

      groups.push({
        items: subscriptionItems,
        key: SettingsGroupKey.Subscription,
        title: t('group.subscription'),
      });
    }

    // Agent group
    const agentItems: CategoryItem[] = [
      // Provider settings should not depend on Advanced tools: new users may need
      // non-LobeHub providers, and desktop users often bring their own API keys.
      providerSettingsVisible && {
        icon: Brain,
        key: SettingsTabs.Provider,
        label: t('tab.provider'),
        url: providerSettingsUrl,
      },
      {
        icon: Sparkles,
        key: SettingsTabs.ServiceModel,
        label: t('tab.serviceModel'),
      },
      {
        icon: SkillsIcon,
        key: SettingsTabs.Skill,
        label: t('tab.skill'),
      },
      userProviderSettingsEnabled && {
        icon: KeyRound,
        key: SettingsTabs.Creds,
        label: t('tab.creds'),
      },
      showApiKeyManage && {
        icon: KeyIcon,
        key: SettingsTabs.APIKey,
        label: tAuth('tab.apikey'),
      },
      {
        icon: MessageCircleIcon,
        key: SettingsTabs.Messenger,
        label: t('tab.messenger'),
      },
    ].filter(Boolean) as CategoryItem[];

    groups.push({
      items: agentItems,
      key: SettingsGroupKey.Agent,
      title: t('group.aiConfig'),
    });

    // System group
    const systemItems: CategoryItem[] = [
      isDesktop && {
        icon: EthernetPort,
        key: SettingsTabs.Proxy,
        label: t('tab.proxy'),
      },
      isDesktop && {
        icon: TerminalSquare,
        key: SettingsTabs.SystemTools,
        label: t('tab.systemTools'),
      },
      {
        icon: Database,
        key: SettingsTabs.Storage,
        label: t('tab.storage'),
      },
      isDevMode && {
        icon: KeyIcon,
        key: SettingsTabs.APIKey,
        label: tAuth('tab.apikey'),
      },
      !hideDocs && {
        icon: Info,
        key: SettingsTabs.About,
        label: t('tab.about'),
      },
    ].filter(Boolean) as CategoryItem[];

    groups.push({
      items: systemItems,
      key: SettingsGroupKey.System,
      title: t('group.system'),
    });

    // Admin group (super admin only)
    if (isSuperAdmin) {
      const adminItems: CategoryItem[] = [
        {
          exact: true,
          icon: LayoutDashboard,
          key: 'admin',
          label: tAdmin('nav.dashboard'),
          url: '/settings/admin',
        },
        {
          icon: Users,
          key: 'admin-users',
          label: tAdmin('nav.users'),
          url: '/settings/admin/users',
        },
        {
          icon: ShoppingCart,
          key: 'admin-orders',
          label: tAdmin('nav.orders'),
          url: '/settings/admin/orders',
        },
        {
          icon: BarChart3,
          key: 'admin-usage',
          label: tAdmin('nav.usage'),
          url: '/settings/admin/usage',
        },
        {
          icon: FileText,
          key: 'admin-audit',
          label: tAdmin('nav.audit'),
          url: '/settings/admin/audit',
        },
      ];

      groups.push({
        items: adminItems,
        key: SettingsGroupKey.Admin,
        title: t('group.admin'),
      });
    }

    return groups;
  }, [
    t,
    tAuth,
    tSubscription,
    tAdmin,
    hideDocs,
    nativeBillingEnabled,
    notificationEnabled,
    referralEnabled,
    showApiKeyManage,
    providerSettingsVisible,
    providerSettingsUrl,
    userProviderSettingsEnabled,
    isDevMode,
    isSuperAdmin,
    avatarUrl,
    username,
  ]);

  return categoryGroups;
};
