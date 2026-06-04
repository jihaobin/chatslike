import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const statusState = vi.hoisted(() => ({
  value: {
    credentialStatus: { configured: false, missingKeys: ['NEWAPI_API_KEY'] },
    enabled: true,
    enabledModelCount: 1,
    futurePricingCount: 1,
    modelCount: 2,
    pricingGapCount: 1,
    provider: 'newapi',
    providerName: 'New API',
  },
}));

const modelsState = vi.hoisted(() => ({
  value: [
    {
      abilities: { reasoning: true },
      contextWindowTokens: 128_000,
      currentPricing: {
        inputCreditsPerMillionTokens: 1000,
        modality: 'text',
        outputCreditsPerMillionTokens: 2000,
        priceKey: 'current',
      },
      displayName: 'GPT 4.1',
      enabled: true,
      hasPricingGap: false,
      id: 'gpt-4.1',
      providerId: 'newapi',
      type: 'chat',
      upstreamDisplayName: 'OpenAI',
      upstreamProvider: 'openai',
      updatedAt: new Date('2026-06-01T00:00:00.000Z'),
    },
    {
      contextWindowTokens: 200_000,
      displayName: 'Claude Sonnet',
      enabled: true,
      hasPricingGap: true,
      id: 'claude-sonnet',
      providerId: 'newapi',
      type: 'chat',
      upstreamDisplayName: 'Anthropic',
      upstreamProvider: 'anthropic',
      updatedAt: new Date('2026-06-01T00:00:00.000Z'),
    },
  ],
}));

const pricingState = vi.hoisted(() => ({
  value: [
    {
      id: 'price-current',
      inputCreditsPerMillionTokens: 1000,
      modality: 'text',
      outputCreditsPerMillionTokens: 2000,
      priceKey: 'current',
      provider: 'newapi',
      status: 'active',
    },
  ],
}));

const serviceMocks = vi.hoisted(() => ({
  adminCreateModelPricingVersion: vi.fn(),
  adminTogglePlatformModelEnabled: vi.fn(),
  adminUpdatePlatformModel: vi.fn(),
}));

const modalConfirm = vi.hoisted(() => vi.fn((config: { onOk?: () => void }) => config.onOk?.()));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock('antd-style', () => ({
  createStaticStyles: (factory: (helpers: Record<string, unknown>) => Record<string, string>) => {
    const styleMap = factory({ css: () => '', cssVar: {} });
    return Object.fromEntries(Object.keys(styleMap).map((key) => [key, key]));
  },
  cssVar: {},
}));

vi.mock('dayjs', () => ({
  default: () => ({ format: () => '2026-06-01 00:00' }),
}));

vi.mock('lucide-react', () => ({
  AlertTriangleIcon: () => <svg />,
  CheckCircleIcon: () => <svg />,
  DatabaseIcon: () => <svg />,
  DollarSignIcon: () => <svg />,
  ExternalLinkIcon: () => <svg />,
  FilterIcon: () => <svg />,
  PencilIcon: () => <svg />,
  RefreshCwIcon: () => <svg />,
  SearchIcon: () => <svg />,
}));

vi.mock('@lobehub/ui', () => ({
  Button: ({
    children,
    disabled,
    icon,
    onClick,
    type,
  }: {
    children?: React.ReactNode;
    disabled?: boolean;
    icon?: React.ReactNode;
    onClick?: () => void;
    type?: string;
  }) => (
    <button data-button-type={type} disabled={disabled} type="button" onClick={onClick}>
      {icon}
      {children}
    </button>
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
  Text: ({ children, code }: { children?: React.ReactNode; code?: boolean }) =>
    code ? <code>{children}</code> : <span>{children}</span>,
}));

vi.mock('antd', () => ({
  DatePicker: ({ onChange }: { onChange?: (_value: unknown, value: string) => void }) => (
    <input
      placeholder="Effective time"
      onChange={(event) => onChange?.(undefined, event.currentTarget.value)}
    />
  ),
  Drawer: ({
    children,
    open,
    title,
  }: {
    children?: React.ReactNode;
    open?: boolean;
    title?: React.ReactNode;
  }) =>
    open ? (
      <section aria-label="drawer">
        <h2>{title}</h2>
        {children}
      </section>
    ) : null,
  Form: Object.assign(
    ({
      children,
      onFinish,
    }: {
      children?: React.ReactNode;
      onFinish?: (values: unknown) => void;
    }) => (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onFinish?.({});
        }}
      >
        {children}
      </form>
    ),
    {
      Item: ({ children, label }: { children?: React.ReactNode; label?: React.ReactNode }) => (
        <label>
          {label}
          {children}
        </label>
      ),
      useForm: () => [
        {
          getFieldsValue: () => ({}),
          resetFields: vi.fn(),
          setFieldsValue: vi.fn(),
        },
      ],
    },
  ),
  InputNumber: ({
    onChange,
    value,
  }: {
    onChange?: (value: number | null) => void;
    value?: number;
  }) => (
    <input
      type="number"
      value={value}
      onChange={(event) => onChange?.(Number(event.currentTarget.value))}
    />
  ),
  Modal: { confirm: modalConfirm },
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
      {options?.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
  Switch: ({ checked, onChange }: { checked?: boolean; onChange?: (checked: boolean) => void }) => (
    <button type="button" onClick={() => onChange?.(!checked)}>
      {checked ? 'enabled' : 'disabled'}
    </button>
  ),
  Table: ({
    columns,
    dataSource,
    onRow,
  }: {
    columns?: Array<{
      dataIndex?: string;
      key?: string;
      render?: (value: unknown, record: Record<string, unknown>) => React.ReactNode;
      title?: React.ReactNode;
    }>;
    dataSource?: Record<string, unknown>[];
    onRow?: (record: Record<string, unknown>) => { onClick?: () => void };
  }) => (
    <div data-testid="platform-model-table">
      {dataSource?.map((record) => (
        <div
          key={String(record.id)}
          role="button"
          tabIndex={0}
          onClick={() => onRow?.(record).onClick?.()}
        >
          {columns?.map((column) => {
            const value = column.dataIndex ? record[column.dataIndex] : undefined;

            return (
              <span key={column.key ?? column.dataIndex}>
                {column.title}
                {column.render ? column.render(value, record) : String(value ?? '')}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  ),
  Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/services/billing', () => ({
  billingService: serviceMocks,
}));

vi.mock('./hooks/useBillingData', () => ({
  refreshPlatformCatalog: vi.fn(),
  usePlatformCatalogModels: () => ({ data: modelsState.value, isLoading: false }),
  usePlatformCatalogStatus: () => ({ data: statusState.value, isLoading: false }),
  usePlatformModelPricing: () => ({ data: pricingState.value, isLoading: false }),
}));

describe('PlatformCatalog', () => {
  beforeEach(() => {
    serviceMocks.adminCreateModelPricingVersion.mockReset();
    serviceMocks.adminTogglePlatformModelEnabled.mockReset();
    serviceMocks.adminUpdatePlatformModel.mockReset();
    modalConfirm.mockClear();
  });

  it('renders New API status, credential state, and catalog metrics', async () => {
    const { default: PlatformCatalog } = await import('./PlatformCatalog');

    render(<PlatformCatalog />);

    expect(screen.getByText('New API 模型目录')).toBeInTheDocument();
    expect(screen.getByText('缺少凭据')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getAllByText('价格缺口').length).toBeGreaterThan(0);
  });

  it('filters models by upstream provider and pricing gaps', async () => {
    const { default: PlatformCatalog } = await import('./PlatformCatalog');

    render(<PlatformCatalog />);

    expect(screen.getByText('GPT 4.1')).toBeInTheDocument();
    expect(screen.getByText('Claude Sonnet')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: /Anthropic/ })[0]);
    expect(screen.queryByText('GPT 4.1')).not.toBeInTheDocument();
    expect(screen.getByText('Claude Sonnet')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /只看价格缺口/ }));
    expect(screen.getByText('Claude Sonnet')).toBeInTheDocument();
  });

  it('opens model drawer with metadata fields and copies current pricing defaults', async () => {
    const { default: PlatformCatalog } = await import('./PlatformCatalog');

    render(<PlatformCatalog />);
    fireEvent.click(screen.getByText('GPT 4.1'));

    const drawer = screen.getByLabelText('drawer');
    expect(drawer).toBeInTheDocument();
    expect(within(drawer).getByText('上游来源')).toBeInTheDocument();
    expect(within(drawer).getByText('OpenAI')).toBeInTheDocument();

    fireEvent.click(within(drawer).getByRole('button', { name: 'Pricing' }));

    expect(within(drawer).getByDisplayValue('1000')).toBeInTheDocument();
    expect(within(drawer).getByText('credits / 1M input tokens')).toBeInTheDocument();
  });

  it('confirms before disabling a model', async () => {
    const { default: PlatformCatalog } = await import('./PlatformCatalog');

    render(<PlatformCatalog />);
    fireEvent.click(screen.getAllByRole('button', { name: 'enabled' })[0]);

    expect(modalConfirm).toHaveBeenCalled();
    await waitFor(() =>
      expect(serviceMocks.adminTogglePlatformModelEnabled).toHaveBeenCalledWith({
        enabled: false,
        model: 'gpt-4.1',
        reason: 'admin_toggle_model',
      }),
    );
  });

  it('uses the selected modality when creating a pricing version', async () => {
    const { default: PlatformCatalog } = await import('./PlatformCatalog');

    render(<PlatformCatalog />);
    fireEvent.click(screen.getByText('Claude Sonnet'));

    const drawer = screen.getByLabelText('drawer');
    fireEvent.click(within(drawer).getByRole('button', { name: 'Pricing' }));
    fireEvent.change(within(drawer).getByDisplayValue('text'), { target: { value: 'image' } });
    fireEvent.click(within(drawer).getByRole('button', { name: /创建价格版本/ }));

    await waitFor(() =>
      expect(serviceMocks.adminCreateModelPricingVersion).toHaveBeenCalledWith(
        expect.objectContaining({
          modality: 'image',
          model: 'claude-sonnet',
        }),
      ),
    );
  });
});
