import { billingEnv } from '../env';
import { PaymentNotConfiguredError } from '../errors';
import type {
  CreatePaymentParams,
  CreatePaymentResult,
  PaymentAdapter,
  PaymentCallbackResult,
} from './types';

const hasAlipaySigningConfig = () =>
  Boolean(billingEnv.alipay.appId && billingEnv.alipay.publicKey);

const verifyAlipayCallbackSignature = () => {
  // TODO: Replace with Alipay OpenAPI RSA2 verification before enabling real checkout.
  return false;
};

export class AlipayAdapter implements PaymentAdapter {
  async createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
    if (!hasAlipaySigningConfig() && !billingEnv.allowMockPayments) {
      throw new PaymentNotConfiguredError('alipay');
    }
    if (!hasAlipaySigningConfig()) {
      return {
        channel: 'alipay',
        qrCodeUrl: `/api/payments/mock/alipay/${params.orderId}`,
      };
    }

    return {
      channel: 'alipay',
      transactionId: params.orderId,
    };
  }

  async parseCallback(request: Request): Promise<PaymentCallbackResult> {
    const form = await request.formData();
    const amountYuan = Number(form.get('total_amount'));

    return {
      amountCents: Math.round(amountYuan * 100),
      channel: 'alipay',
      orderId: String(form.get('out_trade_no') ?? ''),
      providerTransactionId: String(form.get('trade_no') ?? ''),
      rawCallback: Object.fromEntries(form.entries()),
      signatureVerified: hasAlipaySigningConfig() ? verifyAlipayCallbackSignature() : false,
      succeeded: form.get('trade_status') === 'TRADE_SUCCESS',
    };
  }
}
