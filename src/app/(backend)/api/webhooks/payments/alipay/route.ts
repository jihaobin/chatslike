import { BillingOrderService } from '@/business/server/billing/orders';
import { getPaymentAdapter } from '@/business/server/billing/payments';
import { getServerDB } from '@/database/core/db-adaptor';

export async function POST(request: Request) {
  const adapter = getPaymentAdapter('alipay');
  const result = await adapter.parseCallback(request);
  const db = await getServerDB();
  const service = BillingOrderService.forSystem(db);

  await service.markPaidAndActivate(result);

  return new Response(result.succeeded ? 'success' : 'fail');
}
