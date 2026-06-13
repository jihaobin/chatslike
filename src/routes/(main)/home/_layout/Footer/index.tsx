'use client';

import { useAnalytics } from '@lobehub/analytics/react';
import { ActionIcon, Flexbox } from '@lobehub/ui';
import { GithubIcon } from '@lobehub/ui/icons';
import { FlaskConical } from 'lucide-react';
import type { ReactNode } from 'react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import HighlightNotification from '@/components/HighlightNotification';
import { GITHUB } from '@/const/url';
import Billboard from '@/features/Billboard';
import { useActiveNavKey } from '@/features/NavPanel';
import ThemeButton from '@/features/User/UserPanel/ThemeButton';
import { useNavLayout } from '@/hooks/useNavLayout';
import { useGlobalStore } from '@/store/global';
import { systemStatusSelectors } from '@/store/global/selectors/systemStatus';
import { useServerConfigStore } from '@/store/serverConfig';

import { resolveFooterPromotionState } from './promotionPipeline';

const PRODUCT_HUNT_NOTIFICATION = {
  actionHref: 'https://www.producthunt.com/products/lobehub?launch=lobehub',
  endTime: new Date('2026-02-01T00:00:00Z'),
  image: 'https://hub-apac-1.lobeobjects.space/og/lobehub-ph.png',
  slug: 'product-hunt-2026',
  startTime: new Date('2026-01-27T08:00:00Z'),
} as const;

interface PromotionCard {
  actionHref?: string;
  actionIcon?: ReactNode;
  actionLabel: string;
  description: string;
  image?: string;
  onAction?: () => void;
  onActionClick?: () => void;
  onClose: () => void;
  title: string;
}

const Footer = memo(() => {
  const { t } = useTranslation('common');
  const { analytics } = useAnalytics();
  const { footer } = useNavLayout();
  const activeNavKey = useActiveNavKey();
  const isHomeSidebar = activeNavKey === 'home';
  const serverConfigInit = useServerConfigStore((s) => s.serverConfigInit);
  const [isProductHuntCardOpen, setIsProductHuntCardOpen] = useState(false);

  const [isProductHuntNotificationRead, updateSystemStatus] = useGlobalStore((s) => [
    systemStatusSelectors.isNotificationRead(PRODUCT_HUNT_NOTIFICATION.slug)(s),
    s.updateSystemStatus,
  ]);

  const isWithinTimeWindow = useMemo(() => {
    const now = new Date();
    return now >= PRODUCT_HUNT_NOTIFICATION.startTime && now <= PRODUCT_HUNT_NOTIFICATION.endTime;
  }, []);

  const { shouldAutoShowProductHuntCard } = useMemo(
    () =>
      resolveFooterPromotionState({
        isProductHuntNotificationRead,
        isWithinProductHuntWindow: isWithinTimeWindow,
        serverConfigInit,
      }),
    [isProductHuntNotificationRead, isWithinTimeWindow, serverConfigInit],
  );

  const trackPromotionEvent = useCallback(
    (eventName: string, properties: Record<string, string>) => {
      try {
        analytics?.track({ name: eventName, properties });
      } catch {
        // silently ignore tracking errors to avoid affecting business logic
      }
    },
    [analytics],
  );

  const markNotificationRead = useCallback(
    (slug: string) => {
      const currentSlugs = useGlobalStore.getState().status.readNotificationSlugs || [];

      if (currentSlugs.includes(slug)) return;

      updateSystemStatus({ readNotificationSlugs: [...currentSlugs, slug] });
    },
    [updateSystemStatus],
  );

  useEffect(() => {
    if (!shouldAutoShowProductHuntCard) return;

    setIsProductHuntCardOpen(true);
    trackPromotionEvent('product_hunt_card_viewed', {
      spm: 'homepage.product_hunt.viewed',
      trigger: 'auto',
    });
  }, [isWithinTimeWindow, shouldAutoShowProductHuntCard, trackPromotionEvent]);

  const handleCloseProductHuntCard = useCallback(() => {
    setIsProductHuntCardOpen(false);
    markNotificationRead(PRODUCT_HUNT_NOTIFICATION.slug);
    trackPromotionEvent('product_hunt_card_closed', {
      spm: 'homepage.product_hunt.closed',
    });
  }, [markNotificationRead, trackPromotionEvent]);

  const handleProductHuntActionClick = useCallback(() => {
    trackPromotionEvent('product_hunt_action_clicked', {
      spm: 'homepage.product_hunt.action_clicked',
    });
  }, [trackPromotionEvent]);

  const activePromotion = useMemo<PromotionCard | undefined>(() => {
    if (isProductHuntCardOpen) {
      return {
        actionHref: PRODUCT_HUNT_NOTIFICATION.actionHref,
        actionLabel: t('productHunt.actionLabel'),
        description: t('productHunt.description'),
        image: PRODUCT_HUNT_NOTIFICATION.image,
        onActionClick: handleProductHuntActionClick,
        onClose: handleCloseProductHuntCard,
        title: t('productHunt.title'),
      };
    }

    return undefined;
  }, [handleCloseProductHuntCard, handleProductHuntActionClick, isProductHuntCardOpen, t]);

  return (
    <>
      {footer.layout === 'expanded' ? (
        <Flexbox horizontal align={'center'} gap={2} justify={'space-between'} padding={8}>
          <Flexbox horizontal align={'center'} flex={1} gap={2}>
            {!footer.hideGitHub && (
              <a aria-label={'GitHub'} href={GITHUB} rel="noopener noreferrer" target={'_blank'}>
                <ActionIcon icon={GithubIcon} size={16} title={'GitHub'} />
              </a>
            )}
            <Link to="/eval">
              <ActionIcon icon={FlaskConical} size={16} title="Evaluation Lab" />
            </Link>
          </Flexbox>
          <ThemeButton placement={'topCenter'} size={16} />
        </Flexbox>
      ) : null}
      {activePromotion && (
        <HighlightNotification
          open
          actionHref={activePromotion.actionHref}
          actionIcon={activePromotion.actionIcon}
          actionLabel={activePromotion.actionLabel}
          description={activePromotion.description}
          image={activePromotion.image}
          title={activePromotion.title}
          onAction={activePromotion.onAction}
          onActionClick={activePromotion.onActionClick}
          onClose={activePromotion.onClose}
        />
      )}
      {isHomeSidebar && <Billboard />}
    </>
  );
});

export default Footer;
