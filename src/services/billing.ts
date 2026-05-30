import { lambdaClient } from '@/libs/trpc/client';

interface EstimateTextCreditsParams {
  inputTokens: number;
  maxOutputTokens?: number;
  model: string;
  provider: string;
}

interface BillingListParams {
  cursor?: string;
  pageSize?: number;
}

interface CreateTopUpOrderParams {
  channel: 'alipay' | 'wechat';
  productId: string;
}

interface CreateSubscriptionOrderParams {
  channel: 'alipay' | 'wechat';
  period: 'month' | 'year';
  planId: 'starter' | 'premium' | 'ultimate';
}

interface CreateUpgradeOrderParams {
  channel: 'alipay' | 'wechat';
  targetPlanId: 'starter' | 'premium' | 'ultimate';
}

interface AdminBillingCreditMutationParams {
  amountCredits: number;
  reason: string;
  targetUserId: string;
}

interface AdminBillingAccountMutationParams {
  reason: string;
  targetUserId: string;
}

class BillingService {
  adminDeductCredits = async (params: AdminBillingCreditMutationParams) =>
    lambdaClient.adminBilling.deductCredits.mutate(params);

  cancelOrder = async (orderId: string) => lambdaClient.topUp.cancelOrder.mutate({ orderId });

  adminFreezeAccount = async (params: AdminBillingAccountMutationParams) =>
    lambdaClient.adminBilling.freezeAccount.mutate(params);

  adminGrantCredits = async (params: AdminBillingCreditMutationParams) =>
    lambdaClient.adminBilling.grantCredits.mutate(params);

  adminListAuditLogs = async (params?: BillingListParams) =>
    lambdaClient.adminBilling.listAuditLogs.query(params);

  adminListLedger = async (params?: BillingListParams) =>
    lambdaClient.adminBilling.listLedger.query(params);

  adminListOrders = async (params?: BillingListParams) =>
    lambdaClient.adminBilling.listOrders.query(params);

  adminListUsers = async (params?: BillingListParams) =>
    lambdaClient.adminBilling.listUsers.query(params);

  adminUnfreezeAccount = async (params: AdminBillingAccountMutationParams) =>
    lambdaClient.adminBilling.unfreezeAccount.mutate(params);

  createTopUpOrder = async (params: CreateTopUpOrderParams) =>
    lambdaClient.topUp.createOrder.mutate(params);

  createSubscriptionOrder = async (params: CreateSubscriptionOrderParams) =>
    lambdaClient.subscription.createSubscriptionOrder.mutate(params);

  createSubscriptionRenewOrder = async (params: CreateSubscriptionOrderParams) =>
    lambdaClient.subscription.createRenewOrder.mutate(params);

  createSubscriptionUpgradeOrder = async (params: CreateUpgradeOrderParams) =>
    lambdaClient.subscription.createUpgradeOrder.mutate(params);

  estimateText = async (params: EstimateTextCreditsParams) =>
    lambdaClient.spend.estimateText.query(params);

  getBalance = async () => lambdaClient.spend.getBalance.query();

  getOrder = async (orderId: string) => lambdaClient.topUp.getOrder.query({ orderId });

  getCurrentSubscription = async () => lambdaClient.subscription.getCurrent.query();

  listOrders = async (params?: BillingListParams) => lambdaClient.topUp.listOrders.query(params);

  listSubscriptionPlans = async () => lambdaClient.subscription.listPlans.query();

  listUsageRecords = async (params?: BillingListParams) =>
    lambdaClient.spend.listUsageRecords.query(params);
}

export const billingService = new BillingService();
