'use client';

import { isDesktop } from '@lobechat/const';
import { memo } from 'react';

import { commercialRuntime } from '@/business/shared/commercialRuntime';

import { SubscriptionIframeWrapper } from './SubscriptionIframeWrapper';

const Referral = memo(() => {
  if (!commercialRuntime.lobeHubCloudIntegration.enabled) return null;
  if (!isDesktop) return null;
  return <SubscriptionIframeWrapper page="referral" />;
});

Referral.displayName = 'Referral';
export default Referral;
