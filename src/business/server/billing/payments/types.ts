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

export interface PaymentAdapter {
  createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult>;
  parseCallback(request: Request): Promise<PaymentCallbackResult>;
}
