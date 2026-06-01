'use client';

import { isDesktop } from '@lobechat/const';
import { memo } from 'react';

import { commercialRuntime } from '@/business/shared/commercialRuntime';

import { SubscriptionIframeWrapper } from './SubscriptionIframeWrapper';

const Notification = memo(() => {
  if (!commercialRuntime.lobeHubCloudIntegration.enabled) return null;
  if (!isDesktop) return null;

  return <SubscriptionIframeWrapper page="notification" />;
});

Notification.displayName = 'Notification';

export default Notification;
