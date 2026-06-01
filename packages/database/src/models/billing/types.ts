import type {
  CreditGrantSource,
  CreditGrantStatus,
  CreditReservationStatus,
  UsageModality,
} from '../../schemas';

export interface BillingBalance {
  availableCredits: number;
  frozenCredits: number;
  lifetimeConsumedCredits: number;
  lifetimeGrantedCredits: number;
  status: 'active' | 'frozen' | 'risk';
}

export interface CreditGrantPackage {
  billingOrderId: string | null;
  createdAt: Date;
  expiresAt: Date | null;
  id: string;
  remainingCredits: number;
  source: CreditGrantSource;
  startsAt: Date | null;
  status: CreditGrantStatus;
  totalCredits: number;
}

export interface CreditGrantSummary {
  active: {
    rechargeCredits: number;
    subscriptionCredits: number;
    totalCredits: number;
  };
  packages: CreditGrantPackage[];
}

export interface GrantCreditsParams {
  amountCredits: number;
  expiresAt?: Date | null;
  metadata?: Record<string, unknown>;
  operationId: string;
  source: CreditGrantSource;
  startsAt?: Date | null;
}

export interface ReserveCreditsParams {
  businessId?: string | null;
  businessType: UsageModality;
  estimatedCredits: number;
  metadata?: Record<string, unknown>;
  model: string;
  operationId: string;
  provider: string;
}

export interface CaptureReservationParams {
  actualCredits: number;
  operationId: string;
  reservationId: string;
  usageRecordId?: string | null;
}

export interface ReleaseReservationParams {
  operationId: string;
  reason: string;
  reservationId: string;
}

export class InsufficientCreditsError extends Error {
  code = 'INSUFFICIENT_CREDITS' as const;
  error: {
    availableCredits: number;
    code: 'INSUFFICIENT_CREDITS';
    deficitCredits: number;
    requiredCredits: number;
  };
  errorType = 'INSUFFICIENT_CREDITS' as const;
  type = 'INSUFFICIENT_CREDITS' as const;
  availableCredits: number;
  body: {
    availableCredits: number;
    code: 'INSUFFICIENT_CREDITS';
    deficitCredits: number;
    requiredCredits: number;
  };
  deficitCredits: number;
  requiredCredits: number;

  constructor(params: { availableCredits: number; requiredCredits: number }) {
    super('Insufficient credits');
    this.availableCredits = params.availableCredits;
    this.requiredCredits = params.requiredCredits;
    this.deficitCredits = params.requiredCredits - params.availableCredits;
    this.body = {
      availableCredits: this.availableCredits,
      code: this.code,
      deficitCredits: this.deficitCredits,
      requiredCredits: this.requiredCredits,
    };
    this.error = this.body;
  }
}

export class CreditAccountFrozenError extends Error {
  code = 'CREDIT_ACCOUNT_FROZEN' as const;

  constructor() {
    super('Credit account is frozen');
  }
}

export interface ReservationCaptureResult {
  capturedCredits: number;
  releasedCredits: number;
  status: CreditReservationStatus;
}
