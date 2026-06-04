import { isDesktop } from '@lobechat/const';
import { Avatar } from '@lobehub/ui';
import { SkillsIcon } from '@lobehub/ui/icons';
import {
  BellIcon,
  Brain,
  BrainCircuit,
  ChartColumnBigIcon,
  Coins,
  CreditCard,
  Database,
  EllipsisIcon,
  EthernetPort,
  Gift,
  Info,
  KeyboardIcon,
  KeyIcon,
  KeyRound,
  Map,
  MessageCircleIcon,
  PaletteIcon,
  Sparkles,
  TerminalSquare,
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
  Agent = 'agent',
  General = 'general',
  Subscription = 'subscription',
  System = 'system',
}

const SUPER_ADMIN_ROLE = 'super-admin';

export interface CategoryItem {
  icon: any;
  key: SettingsTabs;
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
  const mobile = useServerConfigStore((s) => s.isMobile);
  const { hideDocs, showApiKeyManage, showProvider } = useServerConfigStore(featureFlagsSelectors);
  const [avatar, username] = useUserStore((s) => [
    userProfileSelectors.userAvatar(s),
    userProfileSelectors.nickName(s),
  ]);
  const remoteServerUrl = useElectronStore(electronSyncSelectors.remoteServerUrl);
  const isDevMode = useUserStore((s) => userGeneralSettingsSelectors.config(s).isDevMode);
  const isSuperAdmin = useUserStore(
    (s) => userProfileSelectors.userProfile(s)?.role === SUPER_ADMIN_ROLE,
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
  const notificationEnabled = nativeNotificationEnabled || lobeHubCloudEnabled;
  const referralEnabled = nativeReferralEnabled || lobeHubCloudEnabled;
  const canUseUserProviderSettings = userModelProviderSettingsAdapter.canUseUserProviderSettings(commercial);
  const providerSettingsVisible =
    showProvider && (isSuperAdmin || canUseUserProviderSettings);
  const providerSettingsUrl =
    isSuperAdmin && !canUseUserProviderSettings
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
      {
        icon: PaletteIcon,
        key: SettingsTabs.Appearance,
        label: t('tab.appearance'),
      },
      !mobile && {
        icon: KeyboardIcon,
        key: SettingsTabs.Hotkey,
        label: t('tab.hotkey'),
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
        nativeBillingEnabled &&
          isSuperAdmin && {
            icon: KeyIcon,
            key: SettingsTabs.AdminBilling,
            label: tSubscription('tab.adminBilling'),
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
      {
        icon: BrainCircuit,
        key: SettingsTabs.Memory,
        label: t('tab.memory'),
      },
      {
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
      {
        icon: EllipsisIcon,
        key: SettingsTabs.Advanced,
        label: t('tab.advanced'),
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

    return groups;
  }, [
    t,
    tAuth,
    tSubscription,
    hideDocs,
    mobile,
    nativeBillingEnabled,
    notificationEnabled,
    referralEnabled,
    showApiKeyManage,
    providerSettingsVisible,
    providerSettingsUrl,
    isDevMode,
    isSuperAdmin,
    avatarUrl,
    username,
  ]);

  return categoryGroups;
};
