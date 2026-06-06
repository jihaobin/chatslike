import { billingEnv } from '../env';
import { PaymentNotConfiguredError } from '../errors';
import type {
  ClosePaymentParams,
  CreatePaymentParams,
  CreatePaymentResult,
  PaymentAdapter,
  PaymentCallbackResult,
  PaymentQueryResult,
  QueryPaymentParams,
} from './types';
import {
  type WechatEncryptedResource,
  WechatPayApiV3Service,
  type WechatPayConfig,
  type WechatTransactionResource,
} from './wechat-api-v3';

const getWechatPayConfig = (): WechatPayConfig | undefined => {
  const { apiV3Key, appId, mchId, notifyUrl, privateKey, publicKey, publicKeyId, serialNo } =
    billingEnv.wechatPay;

  if (
    !apiV3Key ||
    !appId ||
    !mchId ||
    !notifyUrl ||
    !privateKey ||
    !publicKey ||
    !publicKeyId ||
    !serialNo
  ) {
    return undefined;
  }

  return { apiV3Key, appId, mchId, notifyUrl, privateKey, publicKey, publicKeyId, serialNo };
};

interface WechatPayNotificationEnvelope {
  resource?: WechatEncryptedResource;
}

const isWechatTransactionResource = (value: unknown): value is WechatTransactionResource => {
  return typeof value === 'object' && value !== null;
};

const toPaymentCallbackResult = (params: {
  config: WechatPayConfig;
  rawCallback: WechatTransactionResource;
  source: 'notification' | 'query';
}): PaymentQueryResult => {
  const signatureVerified =
    params.rawCallback.appid === params.config.appId &&
    params.rawCallback.mchid === params.config.mchId;
  const succeeded =
    signatureVerified &&
    params.rawCallback.trade_state === 'SUCCESS' &&
    params.rawCallback.amount?.currency === 'CNY';

  return {
    amountCents: params.rawCallback.amount?.total ?? 0,
    channel: 'wechat',
    orderId: params.rawCallback.out_trade_no ?? '',
    providerTransactionId: params.rawCallback.transaction_id ?? '',
    rawCallback: { ...params.rawCallback, source: params.source },
    signatureVerified,
    succeeded,
    tradeState: params.rawCallback.trade_state,
  };
};

export class WechatPayAdapter implements PaymentAdapter {
  async closePayment(params: ClosePaymentParams): Promise<void> {
    const config = getWechatPayConfig();
    if (!config) {
      throw new PaymentNotConfiguredError('wechat');
    }

    try {
      await new WechatPayApiV3Service(config).closeTransactionByOutTradeNo(params.orderId);
    } catch (error) {
      if (error instanceof Error && /ORDER_CLOSED|ORDER_NOT_EXIST/.test(error.message)) {
        return;
      }

      throw error;
    }
  }

  async createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
    const config = getWechatPayConfig();
    if (!config && !billingEnv.allowMockPayments) {
      throw new PaymentNotConfiguredError('wechat');
    }
    if (!config) {
      return {
        channel: 'wechat',
        qrCodeUrl: `/api/payments/mock/wechat/${params.orderId}`,
      };
    }

    const payment = await new WechatPayApiV3Service(config).createNativeTransaction(params);

    return {
      channel: 'wechat',
      qrCodeUrl: payment.codeUrl,
    };
  }

  async queryPayment(params: QueryPaymentParams): Promise<PaymentQueryResult | null> {
    const config = getWechatPayConfig();
    if (!config) {
      throw new PaymentNotConfiguredError('wechat');
    }

    const body = await new WechatPayApiV3Service(config).queryTransactionByOutTradeNo(
      params.orderId,
    );
    const result = toPaymentCallbackResult({ config, rawCallback: body, source: 'query' });

    if (result.succeeded && result.amountCents !== params.amountCents) {
      return { ...result, succeeded: false };
    }

    return result;
  }

  async parseCallback(request: Request): Promise<PaymentCallbackResult> {
    return this.parseCallbackPayload({ headers: request.headers, rawBody: await request.text() });
  }

  async parseCallbackPayload(params: {
    headers: Headers;
    rawBody: string;
  }): Promise<PaymentCallbackResult> {
    const config = getWechatPayConfig();
    if (!config) {
      throw new PaymentNotConfiguredError('wechat');
    }

    const service = new WechatPayApiV3Service(config);
    service.verifyNotification(params);

    const envelope = JSON.parse(params.rawBody) as WechatPayNotificationEnvelope;
    if (!envelope.resource) {
      throw new Error('WeChat Pay notification resource missing');
    }
    const body = service.decryptResource<unknown>(envelope.resource);
    if (!isWechatTransactionResource(body)) {
      throw new Error('WeChat Pay notification resource invalid');
    }
    return toPaymentCallbackResult({ config, rawCallback: body, source: 'notification' });
  }
}
