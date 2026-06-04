import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { providerPricingService } from '@/services/providerPricing';
import { withSWR } from '~test-utils';

import ProviderPricing from '..';

const messageApi = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const isMockModality = (value: string): value is 'text' | 'image' | 'video' =>
  value === 'text' || value === 'image' || value === 'video';

vi.mock('@lobehub/ui', () => ({
  Button: ({ children, disabled, onClick }: { children: ReactNode; disabled?: boolean; onClick?: () => void }) => (
    <button disabled={disabled} type="button" onClick={onClick}>
      {children}
    </button>
  ),
  DatePicker: ({ onChange, placeholder, value }: { onChange?: (value: { format: (format: string) => string; toDate: () => Date } | null) => void; placeholder?: string; value?: { format?: (format: string) => string } | null }) => (
    <input
      placeholder={placeholder}
      type="date"
      value={value?.format?.('YYYY-MM-DD') ?? ''}
      onChange={(event) => {
        const dateValue = event.target.value;
        onChange?.(
          dateValue
            ? {
                format: () => dateValue,
                toDate: () => new Date(`${dateValue}T00:00:00.000Z`),
              }
            : null,
        );
      }}
    />
  ),
  Flexbox: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Input: ({ onChange, value }: { onChange?: (event: { target: { value: string } }) => void; value?: string }) => (
    <input value={value} onChange={(event) => onChange?.(event)} />
  ),
  InputNumber: ({ min, onChange, placeholder, precision, step, value }: { min?: number; onChange?: (value: number | null) => void; placeholder?: string; precision?: number; step?: number; value?: number }) => (
    <input
      data-precision={precision}
      min={min}
      placeholder={placeholder}
      step={step}
      type="number"
      value={value ?? ''}
      onChange={(event) => onChange?.(event.target.value ? Number(event.target.value) : null)}
    />
  ),
  Modal: ({ children, footer, open, title }: { children: ReactNode; footer?: ReactNode[]; open: boolean; title: ReactNode }) =>
    open ? (
      <div role="dialog">
        <h2>{title}</h2>
        {children}
        {footer}
      </div>
    ) : null,
  Select: ({ onChange, options, value }: { onChange?: (value: 'text' | 'image' | 'video') => void; options?: { label: ReactNode; value: 'text' | 'image' | 'video' }[]; value?: string }) => (
    <select
      value={value}
      onChange={(event) => {
        if (isMockModality(event.target.value)) onChange?.(event.target.value);
      }}
    >
      {options?.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
  Tag: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  TextArea: ({ onChange, placeholder, value }: { onChange?: (event: { target: { value: string } }) => void; placeholder?: string; value?: string }) => (
    <textarea placeholder={placeholder} value={value} onChange={(event) => onChange?.(event)} />
  ),
}));

vi.mock('antd', () => ({
  App: {
    useApp: () => ({ message: messageApi }),
  },
}));

afterEach(() => {
  vi.restoreAllMocks();
  messageApi.error.mockClear();
  messageApi.success.mockClear();
});

describe('ProviderPricing', () => {
  it('shows readonly summary without create controls', async () => {
    vi.spyOn(providerPricingService, 'listModelPricing').mockResolvedValue([
      {
        effectiveAt: '2026-01-01T00:00:00.000Z',
        id: 'price-1',
        inputCreditsPerMillionTokens: 10,
        model: 'gpt-4o',
        outputCreditsPerMillionTokens: 20,
        provider: 'newapi-openai-relay',
        status: 'active',
      },
    ]);

    render(
      <ProviderPricing
        readonly
        model="gpt-4o"
        provider="newapi-openai-relay"
        scope="user"
      />,
      { wrapper: withSWR },
    );

    await waitFor(() => {
      expect(screen.getByText('providerPricing.current')).toBeInTheDocument();
    });

    expect(screen.getByText('providerPricing.readonly')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'providerPricing.create' })).not.toBeInTheDocument();
  });

  it('shows create action for global admin scope', async () => {
    vi.spyOn(providerPricingService, 'listModelPricing').mockResolvedValue([]);

    render(
      <ProviderPricing model="gpt-4o" provider="newapi-openai-relay" scope="global" />,
      { wrapper: withSWR },
    );

    await waitFor(() => {
      expect(providerPricingService.listModelPricing).toHaveBeenCalledWith({
        model: 'gpt-4o',
        provider: 'newapi-openai-relay',
        scope: 'global',
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'providerPricing.create' }));

    expect(screen.getByRole('dialog')).toHaveTextContent('providerPricing.create');
  });

  it('shows future pricing only in the future section', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-01-01T00:00:00.000Z').getTime());
    vi.spyOn(providerPricingService, 'listModelPricing').mockResolvedValue([
      {
        effectiveAt: '2026-01-01T00:00:00.000Z',
        id: 'current-price',
        inputCreditsPerMillionTokens: 10,
        model: 'gpt-4o',
        provider: 'newapi-openai-relay',
        status: 'active',
      },
      {
        effectiveAt: '2026-02-01T00:00:00.000Z',
        id: 'future-price',
        inputCreditsPerMillionTokens: 12,
        model: 'gpt-4o',
        provider: 'newapi-openai-relay',
        status: 'active',
      },
      {
        effectiveAt: '2025-12-01T00:00:00.000Z',
        id: 'past-active-price',
        inputCreditsPerMillionTokens: 8,
        model: 'gpt-4o',
        provider: 'newapi-openai-relay',
        status: 'active',
      },
      {
        effectiveAt: '2025-11-01T00:00:00.000Z',
        id: 'retired-price',
        inputCreditsPerMillionTokens: 6,
        model: 'gpt-4o',
        provider: 'newapi-openai-relay',
        status: 'retired',
      },
    ]);

    render(
      <ProviderPricing
        readonly
        model="gpt-4o"
        provider="newapi-openai-relay"
        scope="global"
      />,
      { wrapper: withSWR },
    );

    await waitFor(() => {
      expect(screen.getByText('providerPricing.current')).toBeInTheDocument();
    });

    expect(screen.getAllByText('providerPricing.future')).toHaveLength(1);
    expect(screen.getAllByText('providerPricing.history')).toHaveLength(2);
  });

  it('requires at least one price dimension before creating a pricing version', async () => {
    vi.spyOn(providerPricingService, 'listModelPricing').mockResolvedValue([]);
    const create = vi.spyOn(providerPricingService, 'createModelPricingVersion').mockResolvedValue({
      id: 'price-1',
      model: 'gpt-4o',
      provider: 'newapi-openai-relay',
    });

    render(
      <ProviderPricing model="gpt-4o" provider="newapi-openai-relay" scope="global" />,
      { wrapper: withSWR },
    );

    fireEvent.click(await screen.findByRole('button', { name: 'providerPricing.create' }));
    const okButton = screen.getByRole('button', { name: 'ok' });

    fireEvent.change(screen.getByPlaceholderText('providerPricing.reason.placeholder'), {
      target: { value: 'initial price' },
    });

    expect(okButton).toBeDisabled();
    expect(create).not.toHaveBeenCalled();

    const inputPrice = screen.getByPlaceholderText('providerPricing.price.inputCredits.placeholder');

    expect(inputPrice).toHaveAttribute('min', '1');
    expect(inputPrice).toHaveAttribute('step', '1');
    expect(inputPrice).toHaveAttribute('data-precision', '0');

    fireEvent.change(inputPrice, {
      target: { value: '0' },
    });

    expect(okButton).toBeDisabled();
    expect(create).not.toHaveBeenCalled();

    fireEvent.change(inputPrice, {
      target: { value: '10' },
    });

    await waitFor(() => {
      expect(okButton).not.toBeDisabled();
    });

    fireEvent.click(okButton);

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith({
        currency: 'CNY',
        fixedCreditsPerUnit: undefined,
        inputCreditsPerMillionTokens: 10,
        modality: 'text',
        model: 'gpt-4o',
        outputCreditsPerMillionTokens: undefined,
        provider: 'newapi-openai-relay',
        reason: 'initial price',
        scope: 'global',
        unit: 'unit',
      });
    });
  });

  it('copies the current price values and submits a scheduled effective date', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-01-01T00:00:00.000Z').getTime());
    vi.spyOn(providerPricingService, 'listModelPricing').mockResolvedValue([
      {
        currency: 'USD',
        effectiveAt: '2025-12-01T00:00:00.000Z',
        fixedCreditsPerUnit: 3,
        id: 'current-price',
        inputCreditsPerMillionTokens: 10,
        model: 'gpt-4o',
        outputCreditsPerMillionTokens: 20,
        provider: 'newapi-openai-relay',
        status: 'active',
        unit: 'image',
      },
    ]);
    const create = vi.spyOn(providerPricingService, 'createModelPricingVersion').mockResolvedValue({
      id: 'price-2',
      model: 'gpt-4o',
      provider: 'newapi-openai-relay',
    });

    render(
      <ProviderPricing model="gpt-4o" provider="newapi-openai-relay" scope="global" />,
      { wrapper: withSWR },
    );

    await screen.findByText('providerPricing.current');

    fireEvent.click(screen.getByRole('button', { name: 'providerPricing.create' }));

    expect(screen.getByPlaceholderText('providerPricing.price.inputCredits.placeholder')).toHaveValue(10);
    expect(screen.getByPlaceholderText('providerPricing.price.outputCredits.placeholder')).toHaveValue(20);
    expect(screen.getByPlaceholderText('providerPricing.price.fixedCredits.placeholder')).toHaveValue(3);

    fireEvent.change(screen.getByPlaceholderText('providerPricing.reason.placeholder'), {
      target: { value: 'scheduled price' },
    });
    fireEvent.change(screen.getByPlaceholderText('providerPricing.effectiveAt.placeholder'), {
      target: { value: '2026-02-01' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'ok' }));

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith({
        currency: 'USD',
        effectiveAt: new Date('2026-02-01T00:00:00.000Z'),
        fixedCreditsPerUnit: 3,
        inputCreditsPerMillionTokens: 10,
        modality: 'text',
        model: 'gpt-4o',
        outputCreditsPerMillionTokens: 20,
        provider: 'newapi-openai-relay',
        reason: 'scheduled price',
        scope: 'global',
        unit: 'image',
      });
    });
  });

  it('shows feedback when creating a pricing version fails', async () => {
    vi.spyOn(providerPricingService, 'listModelPricing').mockResolvedValue([]);
    const error = new Error('create failed');
    vi.spyOn(providerPricingService, 'createModelPricingVersion').mockRejectedValue(error);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ProviderPricing model="gpt-4o" provider="newapi-openai-relay" scope="global" />,
      { wrapper: withSWR },
    );

    fireEvent.click(await screen.findByRole('button', { name: 'providerPricing.create' }));
    fireEvent.change(screen.getByPlaceholderText('providerPricing.reason.placeholder'), {
      target: { value: 'initial price' },
    });
    fireEvent.change(screen.getByPlaceholderText('providerPricing.price.inputCredits.placeholder'), {
      target: { value: '10' },
    });

    const okButton = screen.getByRole('button', { name: 'ok' });

    await waitFor(() => {
      expect(okButton).not.toBeDisabled();
    });

    fireEvent.click(okButton);

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith('[providerPricing:createModelPricingVersion]', error);
    });

    expect(messageApi.error).toHaveBeenCalledWith('providerPricing.createFailed');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('hides create action for writable user scope', async () => {
    vi.spyOn(providerPricingService, 'listModelPricing').mockResolvedValue([]);

    render(<ProviderPricing model="gpt-4o" provider="openai" scope="user" />, { wrapper: withSWR });

    await waitFor(() => {
      expect(providerPricingService.listModelPricing).toHaveBeenCalledWith({
        model: 'gpt-4o',
        provider: 'openai',
        scope: 'user',
      });
    });

    expect(screen.getByText('providerPricing.readonly')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'providerPricing.create' })).not.toBeInTheDocument();
  });
});
