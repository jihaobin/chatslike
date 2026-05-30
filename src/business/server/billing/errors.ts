export class BillingError extends Error {
  code: string;
  meta: Record<string, unknown>;

  constructor(code: string, message: string, meta: Record<string, unknown> = {}) {
    super(message);
    this.code = code;
    this.meta = meta;
  }
}

export class PricingNotFoundError extends BillingError {
  constructor(meta: Record<string, unknown>) {
    super('PRICING_NOT_FOUND', 'Model pricing not found', meta);
  }
}

export class PaymentNotConfiguredError extends BillingError {
  constructor(channel: string) {
    super('PAYMENT_NOT_CONFIGURED', 'Payment channel is not configured', { channel });
  }
}

export class PhoneVerificationRequiredError extends Error {
  code = 'PHONE_VERIFICATION_REQUIRED' as const;
  error: {
    code: 'PHONE_VERIFICATION_REQUIRED';
  };
  errorType = 'PHONE_VERIFICATION_REQUIRED' as const;
  type = 'PHONE_VERIFICATION_REQUIRED' as const;
  body: {
    code: 'PHONE_VERIFICATION_REQUIRED';
  };

  constructor() {
    super('Phone verification is required');
    this.body = { code: this.code };
    this.error = this.body;
  }
}
