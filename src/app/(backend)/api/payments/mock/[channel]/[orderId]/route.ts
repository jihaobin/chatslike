import { eq } from 'drizzle-orm';

import { getBillingEnv } from '@/business/server/billing/env';
import { BillingOrderService } from '@/business/server/billing/orders';
import { getServerDB } from '@/database/core/db-adaptor';
import type { PaymentChannel } from '@/database/schemas';
import { billingOrders } from '@/database/schemas';

type Params = Promise<{ channel: string; orderId: string }>;

const isPaymentChannel = (channel: string): channel is PaymentChannel =>
  channel === 'alipay' || channel === 'wechat';

export const GET = async (_request: Request, segmentData: { params: Params }) => {
  if (!getBillingEnv().allowMockPayments) {
    return new Response('Mock payments are disabled', { status: 403 });
  }

  const { channel, orderId } = await segmentData.params;
  if (!isPaymentChannel(channel)) {
    return new Response('Unsupported payment channel', { status: 400 });
  }

  const db = await getServerDB();
  const [order] = await db
    .select({
      amountCents: billingOrders.amountCents,
      id: billingOrders.id,
      paymentChannel: billingOrders.paymentChannel,
    })
    .from(billingOrders)
    .where(eq(billingOrders.id, orderId))
    .limit(1);

  if (!order) {
    return new Response('Billing order not found', { status: 404 });
  }

  if (order.paymentChannel !== channel) {
    return new Response('Payment channel mismatch', { status: 400 });
  }

  const service = BillingOrderService.forSystem(db);
  const providerTransactionId = `mock:${channel}:${order.id}`;
  const result = await service.markPaidAndActivate({
    amountCents: order.amountCents,
    channel,
    orderId: order.id,
    providerTransactionId,
    rawCallback: {
      mock: true,
      orderId: order.id,
      source: 'BILLING_ALLOW_MOCK_PAYMENTS',
    },
    signatureVerified: true,
    succeeded: true,
  });

  return Response.json({
    activated: result.activated,
    message: 'Mock payment completed',
    orderId: result.orderId,
    providerTransactionId,
  });
};
