import type { PaymentChannel } from '@/database/schemas';

export interface CreatePaymentParams {
  amountCents: number;
  channel: PaymentChannel;
  description: string;
  orderId: string;
}

export interface CreatePaymentResult {
  channel: PaymentChannel;
  paymentUrl?: string;
  qrCodeUrl?: string;
  transactionId?: string;
}

export interface PaymentCallbackResult {
  amountCents: number;
  channel: PaymentChannel;
  orderId: string;
  providerTransactionId: string;
  rawCallback: Record<string, unknown>;
  signatureVerified: boolean;
  succeeded: boolean;
}

export type WechatPaymentTradeState =
  | 'CLOSED'
  | 'NOTPAY'
  | 'PAYERROR'
  | 'REFUND'
  | 'REVOKED'
  | 'SUCCESS'
  | 'USERPAYING';

export interface PaymentQueryResult extends PaymentCallbackResult {
  tradeState?: WechatPaymentTradeState | string;
}

export interface QueryPaymentParams {
  amountCents: number;
  orderId: string;
}

export interface ClosePaymentParams {
  orderId: string;
}

export interface PaymentAdapter {
  closePayment?: (params: ClosePaymentParams) => Promise<void>;
  createPayment: (params: CreatePaymentParams) => Promise<CreatePaymentResult>;
  parseCallback: (request: Request) => Promise<PaymentCallbackResult>;
  parseCallbackPayload?: (params: {
    headers: Headers;
    rawBody: string;
  }) => Promise<PaymentCallbackResult>;
  queryPayment?: (params: QueryPaymentParams) => Promise<PaymentQueryResult | null>;
}
