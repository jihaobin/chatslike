import useSWR from 'swr';
import { mutate } from 'swr';

import { billingService } from '@/services/billing';

const BILLING_PAGE_SIZE = 20;

export const useBillingBalance = () =>
  useSWR('billing.balance', () => billingService.getBalance(), {
    refreshInterval: 15_000,
  });

export const useBillingOrders = () =>
  useSWR(['billing.orders', BILLING_PAGE_SIZE], () =>
    billingService.listOrders({ pageSize: BILLING_PAGE_SIZE }),
  );

export const refreshBillingOrders = () => mutate(['billing.orders', BILLING_PAGE_SIZE]);

const POLLING_ORDER_STATUSES = new Set(['paid', 'pending']);

export const useBillingOrder = (orderId?: string) =>
  useSWR(orderId ? ['billing.order', orderId] : null, () => billingService.getOrder(orderId!), {
    refreshInterval: (order) =>
      order && POLLING_ORDER_STATUSES.has(order.status) ? 3000 : 0,
  });

export const useSubscriptionPlans = () =>
  useSWR('billing.subscription.plans', () => billingService.listSubscriptionPlans());

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
