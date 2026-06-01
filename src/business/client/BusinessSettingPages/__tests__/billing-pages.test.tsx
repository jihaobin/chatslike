import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@lobechat/const', () => ({
  isDesktop: true,
}));

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
      const PlanLink = components.plan.type;
      const planProps = components.plan.props;

      return (
        <>
          Upgrade to <PlanLink {...planProps}>{values?.planName}</PlanLink> to save {values?.amount}
        </>
      );
    }

    return <>{i18nKey}</>;
  },
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
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
  BoxIcon: () => <svg data-testid="box-icon" />,
  ChevronRightIcon: () => <svg data-testid="chevron-right-icon" />,
  CircleDollarSignIcon: () => <svg data-testid="circle-dollar-sign-icon" />,
  CreditCardIcon: () => <svg data-testid="credit-card-icon" />,
  ExternalLinkIcon: () => <svg data-testid="external-link-icon" />,
  GiftIcon: () => <svg data-testid="gift-icon" />,
  LockOpenIcon: () => <svg data-testid="lock-open-icon" />,
  MinusCircleIcon: () => <svg data-testid="minus-circle-icon" />,
  PencilIcon: () => <svg data-testid="pencil-icon" />,
  ReceiptTextIcon: () => <svg data-testid="receipt-icon" />,
  RefreshCwIcon: () => <svg data-testid="refresh-icon" />,
  ShoppingCartIcon: () => <svg data-testid="shopping-cart-icon" />,
  WalletCardsIcon: () => <svg data-testid="wallet-icon" />,
  WifiIcon: () => <svg data-testid="wifi-icon" />,
}));

vi.mock('antd', () => ({
  Radio: ({ checked }: { checked?: boolean; disabled?: boolean }) => (
    <input readOnly checked={checked} type="radio" />
  ),
}));

vi.mock('@lobehub/ui', () => ({
  Button: ({
    children,
    disabled,
    icon,
    loading,
    onClick,
    type,
  }: {
    children?: React.ReactNode;
    disabled?: boolean;
    icon?: React.ReactNode;
    loading?: boolean;
    onClick?: () => void;
    type?: string;
  }) => (
    <button data-button-type={type} disabled={disabled || loading} type="button" onClick={onClick}>
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
const useAdminBillingUsers = vi.hoisted(() => vi.fn());

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
  }: {
    columns?: {
      dataIndex?: string;
      key?: string;
      render?: (value: unknown, record: Record<string, unknown>) => React.ReactNode;
      title?: React.ReactNode;
    }[];
    dataSource?: unknown[];
    locale?: { emptyText?: React.ReactNode };
  }) => (
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
    </div>
  ),
}));

vi.mock('../SubscriptionIframeWrapper', () => ({
  SubscriptionIframeWrapper: ({ page }: { page: string }) => (
    <div data-page={page} data-testid="subscription-iframe-wrapper" />
  ),
}));

vi.mock('../hooks/useBillingData', () => ({
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
  useCurrentSubscription,
  useBillingOrders: () => ({
    data: { items: [] },
    isLoading: false,
  }),
  useSubscriptionPlans: () => ({
    data: [
      {
        amountCents: { month: 9900, year: 99_000 },
        creditsPerMonth: 5_000_000,
        currency: 'CNY',
        id: 'starter',
        name: 'Starter',
        priceSource: 'temporary_test',
        purchasable: true,
      },
      {
        amountCents: { month: 24_900, year: 249_000 },
        creditsPerMonth: 15_000_000,
        currency: 'CNY',
        id: 'premium',
        name: 'Premium',
        priceSource: 'temporary_test',
        purchasable: true,
      },
      {
        amountCents: { month: 49_900, year: 499_000 },
        creditsPerMonth: 35_000_000,
        currency: 'CNY',
        id: 'ultimate',
        name: 'Ultimate',
        priceSource: 'temporary_test',
        purchasable: true,
      },
    ],
    isLoading: false,
  }),
  useBillingUsageRecords: () => ({
    data: { items: [] },
    isLoading: false,
  }),
}));

describe('Business billing pages', () => {
  beforeEach(() => {
    createSubscriptionOrder.mockReset();
    createSubscriptionRenewOrder.mockReset();
    createSubscriptionUpgradeOrder.mockReset();
    createTopUpOrder.mockReset();
    mutateBalance.mockReset();
    refreshBillingOrders.mockReset();
    useBillingOrder.mockReset();
    useBillingOrder.mockReturnValue({ data: undefined });
    useCurrentSubscription.mockReset();
    useCurrentSubscription.mockReturnValue({ data: null, isLoading: false });
    useAdminBillingUsers.mockReset();
    useAdminBillingUsers.mockReturnValue({
      data: { items: [] },
      isLoading: false,
    });
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

  it('creates a top-up payment order from the credits page', async () => {
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
    const { default: Credits } = await import('../Credits');

    render(<Credits />);
    fireEvent.click(screen.getByRole('button', { name: /Buy Now/ }));

    await waitFor(() =>
      expect(createTopUpOrder).toHaveBeenCalledWith({
        channel: 'alipay',
        productId: 'topup_5m',
      }),
    );
    expect(await screen.findByText('Pending payment order')).toBeInTheDocument();
    expect(screen.getByText('order-1')).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open payment link/ })).toHaveAttribute(
      'href',
      '/api/payments/mock/alipay/order-1',
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

    expect(screen.getByText('$ 3.6')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByText('My Credits Packages'));

    expect(screen.queryByPlaceholderText('1')).not.toBeInTheDocument();
    expect(screen.getByText('$ 3.6')).toBeInTheDocument();

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
    useBillingOrder.mockImplementation((orderId?: string) => ({
      data: orderId ? { id: orderId, status: 'activated' } : undefined,
    }));
    const { default: Credits } = await import('../Credits');

    render(<Credits />);
    fireEvent.click(screen.getByRole('button', { name: /Buy Now/ }));

    expect(await screen.findByText('activated')).toBeInTheDocument();
    await waitFor(() => expect(mutateBalance).toHaveBeenCalled());
    expect(refreshBillingOrders).toHaveBeenCalled();
  }, 30_000);

  it('shows an error when top-up payment order creation fails', async () => {
    createTopUpOrder.mockRejectedValue(new Error('payment not configured'));
    const { default: Credits } = await import('../Credits');

    render(<Credits />);
    fireEvent.click(screen.getByRole('button', { name: /Buy Now/ }));

    expect(
      await screen.findByText(
        'Could not create the payment order. Check payment configuration and try again.',
      ),
    ).toBeInTheDocument();
  }, 30_000);

  it('renders native billing empty state instead of subscription iframe', async () => {
    const { default: Billing } = await import('../Billing');

    render(<Billing />);

    expect(screen.getByText('No orders yet')).toBeInTheDocument();
    expect(screen.queryByTestId('subscription-iframe-wrapper')).not.toBeInTheDocument();
  }, 30_000);

  it('renders native usage empty state instead of subscription iframe', async () => {
    const { default: Usage } = await import('../Usage');

    render(<Usage />);

    expect(screen.getByText('No Credits usage records yet')).toBeInTheDocument();
    expect(screen.queryByTestId('subscription-iframe-wrapper')).not.toBeInTheDocument();
  }, 30_000);

  it('renders purchasable native subscription plans', async () => {
    const { default: Plans } = await import('../Plans');

    render(<Plans />);

    expect(screen.getByText('Free')).toBeInTheDocument();
    expect(screen.getByText('Starter')).toBeInTheDocument();
    expect(screen.getByText('Premium')).toBeInTheDocument();
    expect(screen.getByText('Ultimate')).toBeInTheDocument();
    expect(screen.getByText('5,000,000')).toBeInTheDocument();
    expect(screen.getByText('CNY 99.00 / month')).toBeInTheDocument();
    expect(screen.getByText('CNY 990.00 / year')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Purchase' })[0]).toBeEnabled();
    expect(screen.queryByTestId('subscription-iframe-wrapper')).not.toBeInTheDocument();
  }, 30_000);

  it('creates a subscription payment order from the plans page', async () => {
    createSubscriptionOrder.mockResolvedValue({
      order: {
        amountCents: 9900,
        credits: 5_000_000,
        currency: 'CNY',
        id: 'subscription-order-1',
        status: 'pending',
      },
      payment: {
        channel: 'alipay',
        qrCodeUrl: '/api/payments/mock/alipay/subscription-order-1',
      },
    });
    const { default: Plans } = await import('../Plans');

    render(<Plans />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Purchase' })[0]);

    await waitFor(() =>
      expect(createSubscriptionOrder).toHaveBeenCalledWith({
        channel: 'alipay',
        period: 'month',
        planId: 'starter',
      }),
    );
    expect(await screen.findByText('Pending subscription order')).toBeInTheDocument();
    expect(screen.getByText('subscription-order-1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open payment link' })).toHaveAttribute(
      'href',
      '/api/payments/mock/alipay/subscription-order-1',
    );
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
    fireEvent.click(screen.getByRole('button', { name: 'Renew' }));

    await waitFor(() =>
      expect(createSubscriptionRenewOrder).toHaveBeenCalledWith({
        channel: 'alipay',
        period: 'month',
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
    fireEvent.click(screen.getByRole('button', { name: 'Upgrade' }));

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
});
