import { Icon } from '@lobehub/ui';
import type { ItemType } from 'antd/es/menu/interface';
import { ChartColumnBigIcon, Coins, CreditCard, Map } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { commercialRuntime } from '@/business/shared/commercialRuntime';

export default function useBusinessMenuItems(isSignin: boolean | undefined): ItemType[] {
  const { t } = useTranslation('common');
  const enableNativeBilling = commercialRuntime.nativeBilling.enabled;

  return useMemo(() => {
    if (!isSignin || !enableNativeBilling) return [];

    return [
      {
        type: 'divider',
      },
      {
        icon: <Icon icon={Map} />,
        key: 'business-plans',
        label: <Link to="/settings/plans">{t('userPanel.plans')}</Link>,
      },
      {
        icon: <Icon icon={Coins} />,
        key: 'business-credits',
        label: <Link to="/settings/credits">{t('userPanel.credits')}</Link>,
      },
      {
        icon: <Icon icon={ChartColumnBigIcon} />,
        key: 'business-usage',
        label: <Link to="/settings/usage">{t('userPanel.usages')}</Link>,
      },
      {
        icon: <Icon icon={CreditCard} />,
        key: 'business-billing',
        label: <Link to="/settings/billing">{t('userPanel.billing')}</Link>,
      },
    ];
  }, [enableNativeBilling, isSignin, t]);
}
