import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SUBSCRIPTION_PLANS, SUBSCRIPTION_PRICE_CENTS } from '@/business/server/billing/constants';

vi.mock('@lobechat/const', () => ({
  isDesktop: true,
}));

vi.mock('@lobehub/icons', () => ({
  ModelIcon: ({ model }: { model?: string }) => <span data-testid={`model-icon-${model}`} />,
}));

const translationFallbacks: Record<string, string> = {
  'billingNative.billing.creditsUnit': 'Credits',
  'billingNative.usage.createdAt': 'Created',
  'billingNative.usage.credits': 'Credits',
  'billingNative.usage.details': 'Compute Credits Usage Details',
  'billingNative.usage.duration': 'Duration',
  'billingNative.usage.model': 'Model',
  'billingNative.usage.modality.text': 'Text Generation',
  'billingNative.usage.tokenUsage': 'Token Usage',
  'billingNative.usage.trigger': 'Trigger',
  'billingNative.usage.trigger.chat': 'Chat Message',
  'billingNative.usage.type': 'Type',
  'billingNative.paymentChannel.alipay': 'Alipay',
  'billingNative.paymentChannel.wechat': 'WeChat Pay',
  'billingNative.plans.pixel.discount.max': 'Up to {{percent}} off',
  'billingNative.plans.pixel.discount.short': 'Save {{percent}}',
  'billingNative.plans.pixel.approxImages': 'Approx. {{amount}} images',
  'billingNative.plans.pixel.approxMessages': 'Approx. {{amount}} messages',
  'billingNative.plans.pixel.perMonthAmount': '{{amount}} / month',
  'billingNative.plans.pixel.period.yearly': 'Yearly',
  'billingNative.plans.pixel.price.perMonthYearly': '/ month (yearly)',
  'billingNative.plans.pixel.price.perYear': '{{price}} / year',
  'billingNative.admin.tabs.platform-models': 'Platform Models',
  'compare.title': 'Plan Comparison',
  'modelPricing.perMillionTokens': '1M Tokens',
  'modelPricing.title': 'Text Model Pricing',
  'plans.message.tooltip': 'Estimated based on average {{number}} tokens per message',
};

const toastError = vi.hoisted(() => vi.fn());
const toastInfo = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());
const toastWarning = vi.hoisted(() => vi.fn());
const messageError = vi.hoisted(() => vi.fn());
const messageInfo = vi.hoisted(() => vi.fn());
const messageSuccess = vi.hoisted(() => vi.fn());
const messageWarning = vi.hoisted(() => vi.fn());

vi.mock('react-i18next', () => ({
  Trans: ({
    components,
    i18nKey,
    values,
  }: {
    components?: Record<string, React.ReactElement>;
    i18nKey: string;
    values?: Record<string, React.ReactNode>;
  }) => {
    if (i18nKey === 'billingNative.credits.purchase.upgradeSaving' && components?.plan) {
      const PlanLink = components.plan.type as React.ComponentType<{ children?: React.ReactNode }>;
      const planProps = components.plan.props as { children?: React.ReactNode };

      return (
        <>
          Upgrade to <PlanLink {...planProps}>{values?.planName}</PlanLink> to save {values?.amount}
        </>
      );
    }

    return <>{i18nKey}</>;
  },
  useTranslation: () => ({
    t: (key: string, fallbackOrOptions?: string | Record<string, React.ReactNode>) => {
      const template =
        typeof fallbackOrOptions === 'string'
          ? fallbackOrOptions
          : (translationFallbacks[key] ?? key);
      const values = typeof fallbackOrOptions === 'object' ? fallbackOrOptions : {};

      return Object.entries(values).reduce(
        (text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)),
        template,
      );
    },
  }),
}));

vi.mock('antd-style', () => ({
  createStaticStyles: (factory: (helpers: Record<string, unknown>) => Record<string, string>) => {
    const styleMap = factory({ css: () => '', cssVar: {} });
    return Object.fromEntries(Object.keys(styleMap).map((key) => [key, key]));
  },
  cssVar: {},
}));

vi.mock('lucide-react', () => ({
  BanIcon: () => <svg data-testid="ban-icon" />,
  AtomIcon: () => <svg data-testid="atom-icon" />,
  BoxIcon: () => <svg data-testid="box-icon" />,
  CheckIcon: () => <svg data-testid="check-icon" />,
  ChevronDownIcon: () => <svg data-testid="chevron-down-icon" />,
  ChevronRightIcon: () => <svg data-testid="chevron-right-icon" />,
  CircleDollarSignIcon: () => <svg data-testid="circle-dollar-sign-icon" />,
  CircleHelpIcon: () => <svg data-testid="circle-help-icon" />,
  CreditCardIcon: () => <svg data-testid="credit-card-icon" />,
  ExternalLinkIcon: () => <svg data-testid="external-link-icon" />,
  ArrowDownIcon: () => <svg data-testid="arrow-down-icon" />,
  ArrowUpIcon: () => <svg data-testid="arrow-up-icon" />,
  FileTextIcon: () => <svg data-testid="file-text-icon" />,
  GiftIcon: () => <svg data-testid="gift-icon" />,
  ImageIcon: () => <svg data-testid="image-icon" />,
  LockOpenIcon: () => <svg data-testid="lock-open-icon" />,
  MinusCircleIcon: () => <svg data-testid="minus-circle-icon" />,
  PencilIcon: () => <svg data-testid="pencil-icon" />,
  ReceiptTextIcon: () => <svg data-testid="receipt-icon" />,
  RefreshCwIcon: () => <svg data-testid="refresh-icon" />,
  ShoppingCartIcon: () => <svg data-testid="shopping-cart-icon" />,
  SparklesIcon: () => <svg data-testid="sparkles-icon" />,
  VideoIcon: () => <svg data-testid="video-icon" />,
  WalletCardsIcon: () => <svg data-testid="wallet-icon" />,
  WifiIcon: () => <svg data-testid="wifi-icon" />,
  ZapIcon: () => <svg data-testid="zap-icon" />,
}));

vi.mock('antd', () => ({
  message: {
    error: messageError,
    info: messageInfo,
    success: messageSuccess,
    warning: messageWarning,
  },
  QRCode: ({
    onRefresh,
    status = 'active',
    value,
  }: {
    onRefresh?: () => void;
    status?: string;
    value?: string;
  }) => (
    <button
      data-status={status}
      data-testid="payment-qr-code"
      data-value={value}
      type="button"
      onClick={onRefresh}
    />
  ),
  Radio: ({ checked }: { checked?: boolean; disabled?: boolean }) => (
    <input readOnly checked={checked} type="radio" />
  ),
}));

vi.mock('@lobehub/ui', () => ({
  Button: ({
    'aria-label': ariaLabel,
    children,
    disabled,
    icon,
    loading,
    onClick,
    type,
  }: {
    'aria-label'?: string;
    'children'?: React.ReactNode;
    'disabled'?: boolean;
    'icon'?: React.ReactNode;
    'loading'?: boolean;
    'onClick'?: () => void;
    'type'?: string;
  }) => (
    <button
      aria-label={ariaLabel}
      data-button-type={type}
      disabled={disabled || loading}
      type="button"
      onClick={onClick}
    >
      {icon}
      {children}
    </button>
  ),
  Empty: ({ description, title }: { description?: React.ReactNode; title?: React.ReactNode }) => (
    <div>
      <span>{title}</span>
      <span>{description}</span>
    </div>
  ),
  Flexbox: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  Icon: ({ icon: IconComponent }: { icon?: React.ComponentType }) =>
    IconComponent ? <IconComponent /> : null,
  Input: ({
    onChange,
    placeholder,
    value,
  }: {
    onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    value?: string;
  }) => <input placeholder={placeholder} value={value} onChange={onChange} />,
  InputNumber: ({
    defaultValue,
    min,
    onChange,
    placeholder,
    value,
  }: {
    defaultValue?: number;
    min?: number;
    onChange?: (value: number | null) => void;
    placeholder?: string;
    value?: number;
  }) => (
    <input
      defaultValue={defaultValue}
      min={min}
      placeholder={placeholder}
      type="number"
      value={value}
      onChange={(event) => onChange?.(Number(event.currentTarget.value))}
    />
  ),
  Modal: ({
    children,
    open,
    title,
  }: {
    children?: React.ReactNode;
    open?: boolean;
    title?: React.ReactNode;
  }) =>
    open ? (
      <div aria-label={String(title)} role="dialog">
        {children}
      </div>
    ) : null,
  Select: ({
    onChange,
    options,
    value,
  }: {
    onChange?: (value: string) => void;
    options?: { label: React.ReactNode; value: string }[];
    value?: string;
  }) => (
    <select value={value} onChange={(event) => onChange?.(event.currentTarget.value)}>
      {options?.map((item) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))}
    </select>
  ),
  Skeleton: () => <div data-testid="skeleton" />,
  Tabs: ({
    activeKey,
    items,
    onChange,
  }: {
    activeKey?: string;
    items?: { key: string; label: React.ReactNode }[];
    onChange?: (key: string) => void;
  }) => (
    <div>
      {items?.map((item) => (
        <button
          aria-pressed={activeKey === item.key}
          key={item.key}
          type="button"
          onClick={() => onChange?.(item.key)}
        >
          {item.label}
        </button>
      ))}
    </div>
  ),
  Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  Tooltip: ({ children, title }: { children?: React.ReactNode; title?: React.ReactNode }) => (
    <span>
      {children}
      <span>{title}</span>
    </span>
  ),
  Text: ({
    as,
    children,
    code,
  }: {
    as?: 'h2' | 'span';
    children?: React.ReactNode;
    code?: boolean;
  }) => {
    if (code) return <code>{children}</code>;
    if (as === 'h2') return <h2>{children}</h2>;
    return <span>{children}</span>;
  },
  toast: {
    error: toastError,
    info: toastInfo,
    success: toastSuccess,
    warning: toastWarning,
  },
}));

vi.mock('react-router-dom', () => ({
  Link: ({
    children,
    className,
    to,
  }: {
    children?: React.ReactNode;
    className?: string;
    to: string;
  }) => (
    <a className={className} href={to}>
      {children}
    </a>
  ),
}));

vi.mock('@/features/User/UserAvatar', () => ({
  default: () => <div data-testid="user-avatar" />,
}));

vi.mock('@/store/user', () => ({
  useUserStore: (selector?: (state: Record<string, unknown>) => unknown) =>
    selector ? selector({ user: { fullName: 'Test User' } }) : { user: { fullName: 'Test User' } },
}));

vi.mock('@/store/user/selectors', () => ({
  userProfileSelectors: {
    displayUserName: (state: { user?: { fullName?: string } }) => state.user?.fullName ?? '',
  },
}));

const createTopUpOrder = vi.hoisted(() => vi.fn());
const createSubscriptionOrder = vi.hoisted(() => vi.fn());
const createSubscriptionRenewOrder = vi.hoisted(() => vi.fn());
const createSubscriptionUpgradeOrder = vi.hoisted(() => vi.fn());
const refreshBillingOrders = vi.hoisted(() => vi.fn());
const mutateBalance = vi.hoisted(() => vi.fn());
const useCurrentSubscription = vi.hoisted(() => vi.fn());
const useBillingOrder = vi.hoisted(() => vi.fn());
const useBillingOrderPaymentStatus = vi.hoisted(() => vi.fn());
const useBillingOrders = vi.hoisted(() => vi.fn());
const useBillingUsageRecords = vi.hoisted(() => vi.fn());
const useAdminBillingUsers = vi.hoisted(() => vi.fn());
const inlineTableRender = vi.hoisted(() => vi.fn());
const subscriptionPlanFixtures = vi.hoisted(() => vi.fn());
const textModelPricingFixtures = vi.hoisted(() => vi.fn());

const formatTestPlanAmount = (amountCents: number) => `¥ ${(amountCents / 100).toFixed(1)}`;
const subscriptionPlanFixture = (planId: keyof typeof SUBSCRIPTION_PLANS) => ({
  ...SUBSCRIPTION_PLANS[planId],
  amountCents: SUBSCRIPTION_PRICE_CENTS[planId],
  currency: 'CNY',
  priceSource: 'temporary_test',
  purchasable: true,
});

vi.mock('@/services/billing', () => ({
  billingService: {
    createSubscriptionOrder,
    createSubscriptionRenewOrder,
    createSubscriptionUpgradeOrder,
    createTopUpOrder,
  },
}));

vi.mock('@/components/InlineTable', () => ({
  default: ({
    columns,
    dataSource,
    locale,
    pagination,
  }: {
    columns?: {
      dataIndex?: string;
      key?: string;
      render?: (value: unknown, record: Record<string, unknown>) => React.ReactNode;
      title?: React.ReactNode;
    }[];
    dataSource?: unknown[];
    locale?: { emptyText?: React.ReactNode };
    pagination?: {
      current?: number;
      onChange?: (page: number, pageSize: number) => void;
      pageSize?: number;
      showSizeChanger?: boolean;
    };
  }) => {
    inlineTableRender({ columns, dataSource, locale, pagination });

    return (
      <div data-testid="inline-table">
        {dataSource?.length
          ? dataSource.map((record, rowIndex) => (
              <div key={rowIndex}>
                {columns?.map((column) => {
                  const row = record as Record<string, unknown>;
                  const value = column.dataIndex ? row[column.dataIndex] : undefined;

                  return (
                    <div key={column.key ?? column.dataIndex}>
                      {column.title}
                      {column.render ? column.render(value, row) : String(value ?? '')}
                    </div>
                  );
                })}
              </div>
            ))
          : locale?.emptyText}
        {pagination ? (
          <button type="button" onClick={() => pagination.onChange?.(2, pagination.pageSize ?? 20)}>
            next orders page
          </button>
        ) : null}
      </div>
    );
  },
}));

vi.mock('../SubscriptionIframeWrapper', () => ({
  SubscriptionIframeWrapper: ({ page }: { page: string }) => (
    <div data-page={page} data-testid="subscription-iframe-wrapper" />
  ),
}));

vi.mock('../PlatformCatalog', () => ({
  default: () => <div data-testid="platform-catalog">New API 模型目录</div>,
}));

vi.mock('../hooks/useBillingData', () => ({
  BILLING_PAGE_SIZE: 20,
  PAID_BILLING_ORDER_STATUSES: ['paid', 'activated'],
  useAdminBillingAuditLogs: () => ({
    data: { items: [] },
    isLoading: false,
  }),
  useAdminBillingLedger: () => ({
    data: { items: [] },
    isLoading: false,
  }),
  useAdminBillingOrders: () => ({
    data: { items: [] },
    isLoading: false,
  }),
  useAdminBillingUsers,
  refreshBillingOrders,
  useBillingBalance: () => ({
    data: {
      availableCredits: 500_000,
      frozenCredits: 10_000,
      lifetimeConsumedCredits: 30_000,
      lifetimeGrantedCredits: 540_000,
      status: 'active',
    },
    isLoading: false,
    mutate: mutateBalance,
  }),
  useBillingGrantPackages: () => ({
    data: {
      active: {
        rechargeCredits: 300_000,
        subscriptionCredits: 200_000,
        totalCredits: 500_000,
      },
      packages: [
        {
          billingOrderId: 'order-topup',
          createdAt: new Date('2026-06-01T00:00:00.000Z'),
          expiresAt: new Date('2026-12-01T00:00:00.000Z'),
          id: 'grant-topup',
          remainingCredits: 300_000,
          source: 'top_up',
          startsAt: null,
          status: 'active',
          totalCredits: 500_000,
        },
        {
          billingOrderId: 'order-subscription',
          createdAt: new Date('2026-06-01T00:00:00.000Z'),
          expiresAt: new Date('2026-07-01T00:00:00.000Z'),
          id: 'grant-subscription',
          remainingCredits: 200_000,
          source: 'subscription',
          startsAt: null,
          status: 'active',
          totalCredits: 200_000,
        },
      ],
    },
    isLoading: false,
    mutate: vi.fn(),
  }),
  useBillingOrder,
  useBillingOrderPaymentStatus,
  useCurrentSubscription,
  useBillingOrders,
  useSubscriptionPlans: () => ({
    data: subscriptionPlanFixtures(),
    isLoading: false,
  }),
  useTextModelPricing: () => ({
    data: textModelPricingFixtures(),
    isLoading: false,
  }),
  useBillingUsageRecords,
}));

describe('Business billing pages', () => {
  beforeEach(() => {
    createSubscriptionOrder.mockReset();
    createSubscriptionRenewOrder.mockReset();
    createSubscriptionUpgradeOrder.mockReset();
    createTopUpOrder.mockReset();
    mutateBalance.mockReset();
    refreshBillingOrders.mockReset();
    inlineTableRender.mockClear();
    toastError.mockClear();
    toastInfo.mockClear();
    toastSuccess.mockClear();
    toastWarning.mockClear();
    messageError.mockClear();
    messageInfo.mockClear();
    messageSuccess.mockClear();
    messageWarning.mockClear();
    useBillingOrder.mockReset();
    useBillingOrder.mockReturnValue({ data: undefined });
    useBillingOrderPaymentStatus.mockReset();
    useBillingOrderPaymentStatus.mockReturnValue({ data: undefined });
    useBillingOrders.mockReset();
    useBillingOrders.mockReturnValue({
      data: { items: [] },
      isLoading: false,
    });
    useBillingUsageRecords.mockReset();
    useBillingUsageRecords.mockReturnValue({
      data: { items: [] },
      isLoading: false,
    });
    useCurrentSubscription.mockReset();
    useCurrentSubscription.mockReturnValue({ data: null, isLoading: false });
    useAdminBillingUsers.mockReset();
    useAdminBillingUsers.mockReturnValue({
      data: { items: [] },
      isLoading: false,
    });
    textModelPricingFixtures.mockReset();
    textModelPricingFixtures.mockReturnValue([
      {
        contextWindowTokens: 1_000_000,
        displayName: 'DeepSeek V4 Pro',
        id: 'text:deepseek-v4-pro',
        inputCreditsPerMillionTokens: 435_000,
        model: 'deepseek-v4-pro',
        outputCreditsPerMillionTokens: 870_000,
        provider: 'deepseek',
      },
    ]);
    subscriptionPlanFixtures.mockReturnValue(
      ['starter', 'premium', 'ultimate'].map((planId) =>
        subscriptionPlanFixture(planId as keyof typeof SUBSCRIPTION_PLANS),
      ),
    );
  });

  it('renders native credits balance instead of subscription iframe', async () => {
    const { default: Credits } = await import('../Credits');

    render(<Credits />);

    expect(screen.getByText('Top-up Credits Balance')).toBeInTheDocument();
    expect(screen.getAllByText('300,000').length).toBeGreaterThan(0);
    expect(screen.getByText('Subscription Credits')).toBeInTheDocument();
    expect(screen.getAllByText('200,000').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Purchase Credits').length).toBeGreaterThan(0);
    expect(screen.getByText('5M')).toBeInTheDocument();
    expect(screen.getByText('My Credits Packages')).toBeInTheDocument();
    expect(screen.queryByTestId('subscription-iframe-wrapper')).not.toBeInTheDocument();
  }, 30_000);

  it('creates a WeChat top-up payment order after selecting payment channel', async () => {
    createTopUpOrder.mockResolvedValue({
      order: {
        amountCents: 600,
        credits: 5_000_000,
        currency: 'CNY',
        id: 'order-1',
        status: 'pending',
      },
      payment: {
        channel: 'wechat',
        qrCodeUrl: '/api/payments/mock/wechat/order-1',
      },
    });
    const { default: Credits } = await import('../Credits');

    render(<Credits />);
    fireEvent.click(screen.getByRole('button', { name: /Buy Now/ }));
    expect(screen.getByRole('dialog', { name: 'Select payment method' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'WeChat Pay' }));

    await waitFor(() =>
      expect(createTopUpOrder).toHaveBeenCalledWith({
        channel: 'wechat',
        productId: 'topup_5m',
      }),
    );
    expect(await screen.findByRole('dialog', { name: 'Scan to pay' })).toBeInTheDocument();
    expect(screen.getByTestId('payment-qr-code')).toHaveAttribute(
      'data-value',
      '/api/payments/mock/wechat/order-1',
    );
    expect(screen.getByTestId('payment-qr-code')).toHaveAttribute('data-status', 'active');
    expect(screen.getByText('Scan to pay')).toBeInTheDocument();
    expect(screen.getByText('¥ 6')).toBeInTheDocument();
    expect(screen.queryByText('Pending payment order')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Open payment link/ })).not.toBeInTheDocument();
  }, 30_000);

  it('shows scanned QR state after the order is scanned but not confirmed', async () => {
    createTopUpOrder.mockResolvedValue({
      order: {
        amountCents: 600,
        credits: 5_000_000,
        currency: 'CNY',
        id: 'order-1',
        status: 'pending',
      },
      payment: {
        channel: 'wechat',
        qrCodeUrl: '/api/payments/mock/wechat/order-1',
      },
    });
    useBillingOrderPaymentStatus.mockImplementation((orderId?: string) => ({
      data: orderId
        ? { order: { id: orderId, status: 'pending' }, paymentTradeState: 'USERPAYING' }
        : undefined,
    }));
    const { default: Credits } = await import('../Credits');

    render(<Credits />);
    fireEvent.click(screen.getByRole('button', { name: /Buy Now/ }));
    fireEvent.click(screen.getByRole('button', { name: 'WeChat Pay' }));

    expect(
      await screen.findByText('Scanned. Confirm the payment on your phone.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Scan to pay' })).toBeInTheDocument();
    expect(screen.getByTestId('payment-qr-code')).toHaveAttribute('data-status', 'scanned');
    await waitFor(() =>
      expect(messageInfo).toHaveBeenCalledWith('Scanned. Confirm the payment on your phone.'),
    );
  }, 30_000);

  it('updates custom credits total and hides the custom input when focus leaves purchase controls', async () => {
    const { default: Credits } = await import('../Credits');

    render(<Credits />);
    fireEvent.click(screen.getByRole('button', { name: '20M' }));
    fireEvent.click(screen.getByRole('button', { name: /Custom/ }));

    const customInput = screen.getByPlaceholderText('1');
    expect(customInput).toHaveAttribute('min', '1');
    expect(customInput).toHaveValue(20);

    fireEvent.change(customInput, { target: { value: '3' } });

    expect(screen.getByText('¥ 3.6')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByText('My Credits Packages'));

    expect(screen.queryByPlaceholderText('1')).not.toBeInTheDocument();
    expect(screen.getByText('¥ 3.6')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Custom/ }));
    expect(screen.getByPlaceholderText('1')).toBeInTheDocument();
  }, 30_000);

  it('shows polled activated order status and refreshes billing data', async () => {
    createTopUpOrder.mockResolvedValue({
      order: {
        amountCents: 600,
        credits: 5_000_000,
        currency: 'CNY',
        id: 'order-1',
        status: 'pending',
      },
      payment: {
        channel: 'alipay',
        qrCodeUrl: '/api/payments/mock/alipay/order-1',
      },
    });
    useBillingOrderPaymentStatus.mockImplementation((orderId?: string) => ({
      data: orderId ? { order: { id: orderId, status: 'activated' } } : undefined,
    }));
    const { default: Credits } = await import('../Credits');

    render(<Credits />);
    fireEvent.click(screen.getByRole('button', { name: /Buy Now/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Alipay' }));

    await waitFor(() => expect(mutateBalance).toHaveBeenCalled());
    expect(refreshBillingOrders).toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Scan to pay' })).not.toBeInTheDocument(),
    );
    expect(screen.getByText('Payment successful. Credits have been added.')).toBeInTheDocument();
    expect(messageSuccess).toHaveBeenCalledWith('Payment successful. Credits have been added.');
    expect(screen.queryByText('Pending payment order')).not.toBeInTheDocument();
  }, 30_000);

  it('shows failed and canceled payment toasts and closes the QR modal', async () => {
    createTopUpOrder.mockResolvedValue({
      order: {
        amountCents: 600,
        credits: 5_000_000,
        currency: 'CNY',
        id: 'order-1',
        status: 'pending',
      },
      payment: {
        channel: 'alipay',
        qrCodeUrl: '/api/payments/mock/alipay/order-1',
      },
    });
    useBillingOrderPaymentStatus.mockImplementation((orderId?: string) => ({
      data: orderId ? { order: { id: orderId, status: 'failed' } } : undefined,
    }));
    const { default: Credits } = await import('../Credits');

    const { rerender } = render(<Credits />);
    fireEvent.click(screen.getByRole('button', { name: /Buy Now/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Alipay' }));

    await waitFor(() =>
      expect(messageError).toHaveBeenCalledWith('Payment failed. Please try again.'),
    );
    expect(screen.queryByRole('dialog', { name: 'Scan to pay' })).not.toBeInTheDocument();

    toastError.mockClear();
    toastInfo.mockClear();
    useBillingOrderPaymentStatus.mockImplementation((orderId?: string) => ({
      data: orderId ? { order: { id: orderId, status: 'closed' } } : undefined,
    }));
    rerender(<Credits />);
    fireEvent.click(screen.getByRole('button', { name: /Buy Now/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Alipay' }));

    await waitFor(() => expect(messageInfo).toHaveBeenCalledWith('Payment cancelled'));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Scan to pay' })).not.toBeInTheDocument(),
    );
  }, 30_000);

  it('marks QR code expired after 15 minutes and refreshes it when clicked', async () => {
    createTopUpOrder
      .mockResolvedValueOnce({
        order: {
          amountCents: 600,
          credits: 5_000_000,
          currency: 'CNY',
          id: 'order-1',
          status: 'pending',
        },
        payment: {
          channel: 'wechat',
          qrCodeUrl: '/api/payments/mock/wechat/order-1',
        },
      })
      .mockResolvedValueOnce({
        order: {
          amountCents: 600,
          credits: 5_000_000,
          currency: 'CNY',
          id: 'order-2',
          status: 'pending',
        },
        payment: {
          channel: 'wechat',
          qrCodeUrl: '/api/payments/mock/wechat/order-2',
        },
      });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { default: Credits } = await import('../Credits');

    try {
      render(<Credits />);
      fireEvent.click(screen.getByRole('button', { name: /Buy Now/ }));
      fireEvent.click(screen.getByRole('button', { name: 'WeChat Pay' }));
      expect(await screen.findByTestId('payment-qr-code')).toHaveAttribute(
        'data-value',
        '/api/payments/mock/wechat/order-1',
      );
      act(() => {
        vi.advanceTimersByTime(15 * 60 * 1000);
      });

      expect(
        await screen.findByText('The QR code has expired. Refresh to try again.'),
      ).toBeInTheDocument();
      expect(screen.getByTestId('payment-qr-code')).toHaveAttribute('data-status', 'expired');
      expect(messageWarning).toHaveBeenCalledWith('The QR code has expired. Refresh to try again.');
    } finally {
      vi.useRealTimers();
    }

    fireEvent.click(screen.getByTestId('payment-qr-code'));

    await waitFor(() => expect(createTopUpOrder).toHaveBeenCalledTimes(2));
    expect(createTopUpOrder).toHaveBeenLastCalledWith({
      channel: 'wechat',
      productId: 'topup_5m',
    });
    expect(await screen.findByTestId('payment-qr-code')).toHaveAttribute(
      'data-value',
      '/api/payments/mock/wechat/order-2',
    );
    expect(screen.getByText('Scan to pay')).toBeInTheDocument();
  }, 30_000);

  it('shows an error when top-up payment order creation fails', async () => {
    createTopUpOrder.mockRejectedValue(new Error('payment not configured'));
    const { default: Credits } = await import('../Credits');

    render(<Credits />);
    fireEvent.click(screen.getByRole('button', { name: /Buy Now/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Alipay' }));

    expect(
      await screen.findByText('Failed to create the order. Please try again later.'),
    ).toBeInTheDocument();
    expect(messageError).toHaveBeenCalledWith(
      'Failed to create the order. Please try again later.',
    );
  }, 30_000);

  it('renders native billing empty state instead of subscription iframe', async () => {
    const { default: Billing } = await import('../Billing');

    render(<Billing />);

    expect(useBillingOrders).toHaveBeenCalledWith({
      pageSize: 20,
      statuses: ['paid', 'activated'],
    });
    expect(screen.getByText('No orders yet')).toBeInTheDocument();
    expect(screen.queryByTestId('subscription-iframe-wrapper')).not.toBeInTheDocument();
  }, 30_000);

  it('enables cursor pagination for native billing orders', async () => {
    useBillingOrders
      .mockReturnValueOnce({
        data: {
          items: [
            {
              amountCents: 9900,
              createdAt: new Date('2026-06-01T00:00:00.000Z'),
              credits: 1_000_000,
              currency: 'CNY',
              id: 'order-page-1',
              orderType: 'top_up',
              paymentChannel: 'alipay',
              status: 'paid',
            },
          ],
          nextCursor: 'order-page-1',
        },
        isLoading: false,
      })
      .mockReturnValue({
        data: { items: [], nextCursor: undefined },
        isLoading: false,
      });
    const { default: Billing } = await import('../Billing');

    render(<Billing />);
    fireEvent.click(screen.getByRole('button', { name: 'next orders page' }));

    await waitFor(() =>
      expect(useBillingOrders).toHaveBeenLastCalledWith({
        cursor: 'order-page-1',
        pageSize: 20,
        statuses: ['paid', 'activated'],
      }),
    );
    expect(inlineTableRender).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pagination: expect.objectContaining({
          current: 2,
          pageSize: 20,
          showSizeChanger: true,
        }),
      }),
    );
  }, 30_000);

  it('renders native usage empty state instead of subscription iframe', async () => {
    const { default: Usage } = await import('../Usage');

    render(<Usage />);

    expect(screen.getByText('No Credits usage records yet')).toBeInTheDocument();
    expect(screen.queryByTestId('subscription-iframe-wrapper')).not.toBeInTheDocument();
  }, 30_000);

  it('renders the native usage detail table with token breakdown and duration', async () => {
    useBillingUsageRecords.mockReturnValue({
      data: {
        items: [
          {
            actualCredits: 621,
            createdAt: new Date('2026-05-23T03:23:55.000Z'),
            id: 'usage-1',
            inputTokens: 42_008,
            metadata: { durationMs: 13_460 },
            modality: 'text',
            model: 'deepseek-v4-flash',
            outputTokens: 1115,
            provider: 'deepseek',
            status: 'captured',
          },
        ],
      },
      isLoading: false,
    });
    const { default: Usage } = await import('../Usage');

    render(<Usage />);

    expect(screen.getByText('Usage')).toBeInTheDocument();
    expect(screen.getByText('Compute Credits Usage Details')).toBeInTheDocument();
    expect(inlineTableRender).toHaveBeenLastCalledWith(
      expect.objectContaining({
        columns: expect.arrayContaining([
          expect.objectContaining({ title: 'Created' }),
          expect.objectContaining({ title: 'Type' }),
          expect.objectContaining({ title: 'Trigger' }),
          expect.objectContaining({ title: 'Model' }),
          expect.objectContaining({ title: 'Token Usage' }),
          expect.objectContaining({ title: 'Credits' }),
          expect.objectContaining({ title: 'Duration' }),
        ]),
      }),
    );
    expect(screen.getByText('Text Generation')).toBeInTheDocument();
    expect(screen.getByText('Chat Message')).toBeInTheDocument();
    expect(screen.getByText('deepseek-v4-flash')).toBeInTheDocument();
    expect(screen.getByText('43,123')).toBeInTheDocument();
    expect(screen.getByText('=')).toBeInTheDocument();
    expect(screen.getByText('42,008')).toBeInTheDocument();
    expect(screen.getByText('+')).toBeInTheDocument();
    expect(screen.getByText('1,115')).toBeInTheDocument();
    expect(screen.getByText('621')).toBeInTheDocument();
    expect(screen.getByText('13.46s')).toBeInTheDocument();
  }, 30_000);

  it('renders purchasable native subscription plans', async () => {
    const { default: Plans } = await import('../Plans');

    render(<Plans />);

    expect(screen.getByText('Plans')).toBeInTheDocument();
    expect(screen.getByText('Yearly')).toBeInTheDocument();
    expect(screen.getByText('Up to 17% off')).toBeInTheDocument();
    expect(
      screen.getByText(formatTestPlanAmount(SUBSCRIPTION_PRICE_CENTS.starter.year / 12)),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        `${formatTestPlanAmount(SUBSCRIPTION_PRICE_CENTS.starter.month * 12)} / year`,
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Starter').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Premium').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Ultimate').length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(new RegExp(SUBSCRIPTION_PLANS.starter.creditsPerMonth.toLocaleString()))
        .length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText('Approx. 4,597 messages').length).toBeGreaterThan(0);
    expect(
      screen.getAllByText('Estimated based on average 2500 tokens per message').length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('DeepSeek V4 Pro (1M)')).toBeInTheDocument();
    expect(screen.getByText('0.435M')).toBeInTheDocument();
    expect(screen.getByText('0.87M')).toBeInTheDocument();
    expect(screen.getByText('Plan Comparison')).toBeInTheDocument();
    expect(screen.getByText('FAQ')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Purchase' })[0]).toBeEnabled();
    expect(screen.queryByTestId('subscription-iframe-wrapper')).not.toBeInTheDocument();
  }, 30_000);

  it('derives yearly discount labels and original yearly price from current plan prices', async () => {
    subscriptionPlanFixtures.mockReturnValue([
      {
        ...subscriptionPlanFixture('starter'),
        amountCents: { month: 10_000, year: 90_000 },
      },
      {
        ...subscriptionPlanFixture('premium'),
        amountCents: { month: 20_000, year: 216_000 },
      },
      {
        ...subscriptionPlanFixture('ultimate'),
        amountCents: { month: 30_000, year: 240_000 },
      },
    ]);
    const { default: Plans } = await import('../Plans');

    render(<Plans />);

    expect(screen.getByText('Up to 33% off')).toBeInTheDocument();
    expect(screen.getAllByText('Save 10%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Save 33%').length).toBeGreaterThan(0);
    expect(screen.getByText('¥ 3,600.0 / year')).toBeInTheDocument();
  }, 30_000);

  it('creates a WeChat subscription payment order after selecting payment channel', async () => {
    createSubscriptionOrder.mockResolvedValue({
      order: {
        amountCents: 9900,
        credits: 5_000_000,
        currency: 'CNY',
        id: 'subscription-order-1',
        status: 'pending',
      },
      payment: {
        channel: 'wechat',
        qrCodeUrl: '/api/payments/mock/wechat/subscription-order-1',
      },
    });
    useBillingOrderPaymentStatus.mockImplementation((orderId?: string) => ({
      data: orderId
        ? { order: { id: orderId, status: 'pending' }, paymentTradeState: 'USERPAYING' }
        : undefined,
    }));
    const { default: Plans } = await import('../Plans');

    render(<Plans />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Purchase' })[0]);
    expect(screen.getByRole('dialog', { name: 'Select payment method' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'WeChat Pay' }));

    await waitFor(() =>
      expect(createSubscriptionOrder).toHaveBeenCalledWith({
        channel: 'wechat',
        period: 'year',
        planId: 'starter',
      }),
    );
    expect(await screen.findByRole('dialog', { name: 'Scan to pay' })).toBeInTheDocument();
    expect(screen.getByTestId('payment-qr-code')).toHaveAttribute(
      'data-value',
      '/api/payments/mock/wechat/subscription-order-1',
    );
    expect(screen.getByTestId('payment-qr-code')).toHaveAttribute('data-status', 'scanned');
    expect(screen.getByText('¥ 99')).toBeInTheDocument();
    expect(screen.queryByText('Pending subscription order')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open payment link' })).not.toBeInTheDocument();
  }, 30_000);

  it('creates a renewal order for the active current plan', async () => {
    useCurrentSubscription.mockReturnValue({
      data: {
        currentPeriodEnd: new Date('2026-07-01T00:00:00.000Z'),
        currentPeriodStart: new Date('2026-06-01T00:00:00.000Z'),
        orderId: 'current-order',
        period: 'month',
        planId: 'premium',
      },
      isLoading: false,
    });
    createSubscriptionRenewOrder.mockResolvedValue({
      order: {
        amountCents: 24_900,
        credits: 15_000_000,
        currency: 'CNY',
        id: 'renew-order-1',
        status: 'pending',
      },
      payment: {
        channel: 'alipay',
        qrCodeUrl: '/api/payments/mock/alipay/renew-order-1',
      },
    });
    const { default: Plans } = await import('../Plans');

    render(<Plans />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Renew' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Alipay' }));

    await waitFor(() =>
      expect(createSubscriptionRenewOrder).toHaveBeenCalledWith({
        channel: 'alipay',
        period: 'year',
        planId: 'premium',
      }),
    );
    expect(createSubscriptionOrder).not.toHaveBeenCalled();
    expect(await screen.findByText('renew-order-1')).toBeInTheDocument();
  }, 30_000);

  it('creates an upgrade order for a higher plan and disables lower plans', async () => {
    useCurrentSubscription.mockReturnValue({
      data: {
        currentPeriodEnd: new Date('2026-07-01T00:00:00.000Z'),
        currentPeriodStart: new Date('2026-06-01T00:00:00.000Z'),
        orderId: 'current-order',
        period: 'month',
        planId: 'premium',
      },
      isLoading: false,
    });
    createSubscriptionUpgradeOrder.mockResolvedValue({
      order: {
        amountCents: 25_000,
        credits: 20_000_000,
        currency: 'CNY',
        id: 'upgrade-order-1',
        status: 'pending',
      },
      payment: {
        channel: 'alipay',
        qrCodeUrl: '/api/payments/mock/alipay/upgrade-order-1',
      },
    });
    const { default: Plans } = await import('../Plans');

    render(<Plans />);

    const delayedButtons = screen.getAllByRole('button', {
      name: 'Available after current period',
    });
    expect(delayedButtons).toHaveLength(2);
    expect(delayedButtons[0]).toBeDisabled();
    expect(delayedButtons[1]).toBeDisabled();
    fireEvent.click(screen.getAllByRole('button', { name: 'Upgrade' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Alipay' }));

    await waitFor(() =>
      expect(createSubscriptionUpgradeOrder).toHaveBeenCalledWith({
        channel: 'alipay',
        targetPlanId: 'ultimate',
      }),
    );
    expect(createSubscriptionOrder).not.toHaveBeenCalled();
    expect(await screen.findByText('upgrade-order-1')).toBeInTheDocument();
  }, 30_000);

  it('renders admin user account status and credit aggregates', async () => {
    useAdminBillingUsers.mockReturnValue({
      data: {
        items: [
          {
            accountStatus: 'risk',
            availableCredits: 100_000,
            createdAt: new Date('2026-06-01T00:00:00.000Z'),
            email: 'target@example.com',
            frozenCredits: 20_000,
            id: 'target-user',
            lifetimeConsumedCredits: 30_000,
            lifetimeGrantedCredits: 150_000,
            phone: '+8613800000000',
            role: null,
          },
        ],
      },
      isLoading: false,
    });
    const { default: AdminBilling } = await import('../AdminBilling');

    render(<AdminBilling />);

    expect(screen.getByText('Account Status')).toBeInTheDocument();
    expect(screen.getByText('Available Credits')).toBeInTheDocument();
    expect(screen.getByText('Frozen Credits')).toBeInTheDocument();
    expect(screen.getByText('risk')).toBeInTheDocument();
    expect(screen.getByText('100,000')).toBeInTheDocument();
    expect(screen.getByText('20,000')).toBeInTheDocument();
    expect(screen.getByText('Granted: 150,000')).toBeInTheDocument();
    expect(screen.getByText('Consumed: 30,000')).toBeInTheDocument();
  }, 30_000);

  it('exposes the New API platform catalog from admin billing', async () => {
    const { default: AdminBilling } = await import('../AdminBilling');

    render(<AdminBilling />);
    fireEvent.click(screen.getByRole('button', { name: 'Platform Models' }));

    expect(await screen.findByTestId('platform-catalog')).toBeInTheDocument();
    expect(screen.getByText('New API 模型目录')).toBeInTheDocument();
  }, 30_000);
});
