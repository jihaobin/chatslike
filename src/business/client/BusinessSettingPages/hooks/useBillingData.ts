import useSWR, { mutate } from 'swr';

import type { ModelPricingListParams, PlatformCatalogFilters } from '@/services/billing';
import { billingService } from '@/services/billing';

export const BILLING_PAGE_SIZE = 20;
export const PAID_BILLING_ORDER_STATUSES = ['paid', 'activated'] as const;
const BILLING_ORDERS_KEY = 'billing.orders';

export interface BillingOrdersParams {
  cursor?: string;
  pageSize?: number;
  statuses?: ReadonlyArray<(typeof PAID_BILLING_ORDER_STATUSES)[number]>;
}

export const useBillingBalance = () =>
  useSWR('billing.balance', () => billingService.getBalance(), {
    refreshInterval: 15_000,
  });

export const useBillingGrantPackages = () =>
  useSWR('billing.grantPackages', () => billingService.listGrantPackages(), {
    refreshInterval: 15_000,
  });

export const useBillingOrders = (params: BillingOrdersParams = {}) => {
  const pageSize = params.pageSize ?? BILLING_PAGE_SIZE;
  const statuses = params.statuses ?? PAID_BILLING_ORDER_STATUSES;

  return useSWR([BILLING_ORDERS_KEY, pageSize, params.cursor, statuses], () =>
    billingService.listOrders({ cursor: params.cursor, pageSize, statuses }),
  );
};

export const refreshBillingOrders = () =>
  mutate((key) => Array.isArray(key) && key[0] === BILLING_ORDERS_KEY);

const POLLING_ORDER_STATUSES = new Set(['paid', 'pending']);

export const useBillingOrder = (orderId?: string) =>
  useSWR(orderId ? ['billing.order', orderId] : null, () => billingService.getOrder(orderId!), {
    refreshInterval: (order) => (order && POLLING_ORDER_STATUSES.has(order.status) ? 3000 : 0),
  });

export const useBillingOrderPaymentStatus = (orderId?: string) =>
  useSWR(
    orderId ? ['billing.orderPaymentStatus', orderId] : null,
    () => billingService.syncOrderPaymentStatus(orderId!),
    {
      refreshInterval: (data) =>
        data?.order && POLLING_ORDER_STATUSES.has(data.order.status) ? 3000 : 0,
    },
  );

export const useSubscriptionPlans = () =>
  useSWR('billing.subscription.plans', () => billingService.listSubscriptionPlans());

export const useTextModelPricing = () =>
  useSWR('billing.subscription.textModelPricing', () => billingService.listTextModelPricing());

export const useCurrentSubscription = () =>
  useSWR('billing.subscription.current', () => billingService.getCurrentSubscription(), {
    refreshInterval: 30_000,
  });

export const useBillingUsageRecords = () =>
  useSWR(['billing.usageRecords', BILLING_PAGE_SIZE], () =>
    billingService.listUsageRecords({ pageSize: BILLING_PAGE_SIZE }),
  );

export const useAdminBillingAuditLogs = () =>
  useSWR(['billing.admin.auditLogs', BILLING_PAGE_SIZE], () =>
    billingService.adminListAuditLogs({ pageSize: BILLING_PAGE_SIZE }),
  );

export const useAdminBillingLedger = () =>
  useSWR(['billing.admin.ledger', BILLING_PAGE_SIZE], () =>
    billingService.adminListLedger({ pageSize: BILLING_PAGE_SIZE }),
  );

export const useAdminBillingOrders = () =>
  useSWR(['billing.admin.orders', BILLING_PAGE_SIZE], () =>
    billingService.adminListOrders({ pageSize: BILLING_PAGE_SIZE }),
  );

export const useAdminBillingUsers = () =>
  useSWR(['billing.admin.users', BILLING_PAGE_SIZE], () =>
    billingService.adminListUsers({ pageSize: BILLING_PAGE_SIZE }),
  );

export const usePlatformCatalogStatus = () =>
  useSWR('billing.admin.platformCatalog.status', () =>
    billingService.adminGetNewApiProviderStatus(),
  );

export const usePlatformCatalogModels = (filters: PlatformCatalogFilters = {}) =>
  useSWR(['billing.admin.platformCatalog.models', filters], () =>
    billingService.adminListPlatformModels(filters),
  );

export const usePlatformModelPricing = (params?: ModelPricingListParams) =>
  useSWR(params ? ['billing.admin.platformCatalog.pricing', params] : null, () =>
    billingService.adminListModelPricing(params!),
  );

export const refreshPlatformCatalog = (filters: PlatformCatalogFilters = {}) =>
  Promise.all([
    mutate('billing.admin.platformCatalog.status'),
    mutate(['billing.admin.platformCatalog.models', filters]),
  ]);
