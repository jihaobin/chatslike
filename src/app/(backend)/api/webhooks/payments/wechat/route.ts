import { NextResponse } from 'next/server';

import { BillingOrderService } from '@/business/server/billing/orders';
import { getPaymentAdapter } from '@/business/server/billing/payments';
import { getServerDB } from '@/database/core/db-adaptor';

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const adapter = getPaymentAdapter('wechat');
    const result = adapter.parseCallbackPayload
      ? await adapter.parseCallbackPayload({ headers: request.headers, rawBody })
      : await adapter.parseCallback(
          new Request(request.url, {
            body: rawBody,
            headers: request.headers,
            method: request.method,
          }),
        );
    const db = await getServerDB();
    const service = BillingOrderService.forSystem(db);

    await service.markPaidAndActivate(result);

    return NextResponse.json({ code: 'SUCCESS', message: '成功' });
  } catch (error) {
    console.error(error);

    return NextResponse.json({ code: 'FAIL', message: '失败' }, { status: 500 });
  }
}
