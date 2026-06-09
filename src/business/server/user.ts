/* eslint-disable unused-imports/no-unused-vars */
import type { ReferralStatusString } from '@lobechat/types';
import { Plans } from '@lobechat/types';

import type { LobeChatDatabase, Transaction } from '@/database/type';

import { grantTrialCreditsAfterPhoneVerified } from './billing/trial';

export interface OnUserActivityForBusinessParams {
  currentTime: Date;
  previousLastActiveAt: Date;
  userCreatedAt: Date;
  userId: string;
}

export interface OnBusinessUserPhoneVerifiedParams {
  db: LobeChatDatabase | Transaction;
  phoneNumber: string;
  userId: string;
}

export async function getReferralStatus(userId: string): Promise<ReferralStatusString | undefined> {
  return undefined;
}

export async function getSubscriptionPlan(userId: string): Promise<Plans> {
  return Plans.Free;
}

export async function initNewUserForBusiness(
  userId: string,
  createdAt: Date | null | undefined,
): Promise<void> {}

export async function onUserActivityForBusiness(
  params: OnUserActivityForBusinessParams,
): Promise<void> {}

export async function onBusinessUserPhoneVerified(params: OnBusinessUserPhoneVerifiedParams) {
  return grantTrialCreditsAfterPhoneVerified(params.db, {
    phoneNumber: params.phoneNumber,
    userId: params.userId,
  });
}
