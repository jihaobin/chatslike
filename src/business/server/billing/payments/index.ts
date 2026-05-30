import type { PaymentChannel } from '@/database/schemas';

import { AlipayAdapter } from './alipay';
import type { PaymentAdapter } from './types';
import { WechatPayAdapter } from './wechat';

export function getPaymentAdapter(channel: PaymentChannel): PaymentAdapter {
  if (channel === 'alipay') return new AlipayAdapter();

  return new WechatPayAdapter();
}
