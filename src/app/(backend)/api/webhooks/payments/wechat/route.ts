import { NextResponse } from 'next/server';

import { BillingOrderService } from '@/business/server/billing/orders';
import { getPaymentAdapter } from '@/business/server/billing/payments';
import { getServerDB } from '@/database/core/db-adaptor';

export async function POST(request: Request) {
  const adapter = getPaymentAdapter('wechat');
  const result = await adapter.parseCallback(request);
  const db = await getServerDB();
  const service = BillingOrderService.forSystem(db);

  await service.markPaidAndActivate(result);

  return NextResponse.json({ code: 'SUCCESS', message: '成功' });
}
