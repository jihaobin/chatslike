import { billingEnv } from '../env';
import { PaymentNotConfiguredError } from '../errors';
import type {
  CreatePaymentParams,
  CreatePaymentResult,
  PaymentAdapter,
  PaymentCallbackResult,
} from './types';

const hasWechatPaySigningConfig = () =>
  Boolean(
    billingEnv.wechatPay.appId &&
    billingEnv.wechatPay.apiV3Key &&
    billingEnv.wechatPay.mchId &&
    billingEnv.wechatPay.privateKey &&
    billingEnv.wechatPay.serialNo,
  );

const verifyWechatPayCallbackSignature = () => {
  // TODO: Replace with WeChat Pay v3 signature and resource decryption before real checkout.
  return false;
};

interface WechatPayCallbackBody {
  amount?: { total?: number };
  out_trade_no?: string;
  trade_state?: string;
  transaction_id?: string;
}

export class WechatPayAdapter implements PaymentAdapter {
  async createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
    if (!hasWechatPaySigningConfig() && !billingEnv.allowMockPayments) {
      throw new PaymentNotConfiguredError('wechat');
    }
    if (!hasWechatPaySigningConfig()) {
      return {
        channel: 'wechat',
        qrCodeUrl: `/api/payments/mock/wechat/${params.orderId}`,
      };
    }

    return {
      channel: 'wechat',
      transactionId: params.orderId,
    };
  }

  async parseCallback(request: Request): Promise<PaymentCallbackResult> {
    const body = (await request.json()) as WechatPayCallbackBody;

    return {
      amountCents: body.amount?.total ?? 0,
      channel: 'wechat',
      orderId: body.out_trade_no ?? '',
      providerTransactionId: body.transaction_id ?? '',
      rawCallback: body as Record<string, unknown>,
      signatureVerified: hasWechatPaySigningConfig() ? verifyWechatPayCallbackSignature() : false,
      succeeded: body.trade_state === 'SUCCESS',
    };
  }
}
