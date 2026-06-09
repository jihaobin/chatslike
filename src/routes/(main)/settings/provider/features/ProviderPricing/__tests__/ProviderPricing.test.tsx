import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ProviderPricingRecord } from '@/services/providerPricing';
import { providerPricingService } from '@/services/providerPricing';
import { withSWR } from '~test-utils';

import ProviderPricing from '..';
import PriceVersionModal from '../PriceVersionModal';

const messageApi = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (!options) return key;

      if (options.value && !key.includes('{{value}}')) return `${key} ${options.value}`;

      return Object.entries(options).reduce(
        (text, [optionKey, value]) => text.replaceAll(`{{${optionKey}}}`, String(value)),
        key,
      );
    },
  }),
}));

vi.mock('@lobehub/ui', () => ({
  Button: ({
    children,
    disabled,
    onClick,
  }: {
    children: ReactNode;
    disabled?: boolean;
    onClick?: () => void;
  }) => (
    <button disabled={disabled} type="button" onClick={onClick}>
      {children}
    </button>
  ),
  DatePicker: ({
    onChange,
    placeholder,
    value,
  }: {
    onChange?: (value: { format: (format: string) => string; toDate: () => Date } | null) => void;
    placeholder?: string;
    value?: { format?: (format: string) => string } | null;
  }) => (
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
  Input: ({
    onChange,
    value,
  }: {
    onChange?: (event: { target: { value: string } }) => void;
    value?: string;
  }) => <input value={value} onChange={(event) => onChange?.(event)} />,
  InputNumber: ({
    'aria-label': ariaLabel,
    min,
    onChange,
    placeholder,
    precision,
    step,
    value,
  }: {
    'aria-label'?: string;
    'min'?: number;
    'onChange'?: (value: number | null) => void;
    'placeholder'?: string;
    'precision'?: number;
    'step'?: number;
    'value'?: number;
  }) => (
    <input
      aria-label={ariaLabel}
      data-precision={precision}
      min={min}
      placeholder={placeholder}
      step={step}
      type="number"
      value={value ?? ''}
      onChange={(event) => onChange?.(event.target.value ? Number(event.target.value) : null)}
    />
  ),
  Modal: ({
    children,
    footer,
    open,
    title,
  }: {
    children: ReactNode;
    footer?: ReactNode[];
    open: boolean;
    title: ReactNode;
  }) =>
    open ? (
      <div role="dialog">
        <h2>{title}</h2>
        {children}
        {footer}
      </div>
    ) : null,
  Select: ({
    onChange,
    options,
    value,
  }: {
    onChange?: (value: string) => void;
    options?: { disabled?: boolean; label: ReactNode; value: string }[];
    value?: string;
  }) => (
    <select
      value={value}
      onChange={(event) => {
        onChange?.(event.target.value);
      }}
    >
      {options?.map((option) => (
        <option disabled={option.disabled} key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
  Tag: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  TextArea: ({
    onChange,
    placeholder,
    value,
  }: {
    onChange?: (event: { target: { value: string } }) => void;
    placeholder?: string;
    value?: string;
  }) => (
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
  it('formats stored token rates as display million-credit values', async () => {
    vi.spyOn(providerPricingService, 'listModelPricing').mockResolvedValue([
      {
        actualCredits: undefined,
        id: 'mpr_current',
        inputCreditsPerMillionTokens: 5_000_000,
        model: 'gpt-5.5',
        outputCreditsPerMillionTokens: 30_000_000,
        provider: 'amux',
        status: 'active',
      } as ProviderPricingRecord,
    ]);

    render(<ProviderPricing model="gpt-5.5" modelType="chat" provider="amux" scope="global" />, {
      wrapper: withSWR,
    });

    expect(await screen.findByText((text) => text.includes('5M'))).toBeInTheDocument();
    expect(screen.getByText((text) => text.includes('30M'))).toBeInTheDocument();
  });

  it('passes upstream pricing to the price version modal', async () => {
    vi.spyOn(providerPricingService, 'listModelPricing').mockResolvedValue([]);

    render(
      <ProviderPricing
        model="gpt-5.5"
        modelType="chat"
        provider="amux"
        scope="global"
        upstreamPricing={{
          currency: 'USD',
          units: [
            { name: 'textInput', rate: 5, strategy: 'fixed', unit: 'millionTokens' },
            { name: 'textOutput', rate: 30, strategy: 'fixed', unit: 'millionTokens' },
          ],
        }}
      />,
      { wrapper: withSWR },
    );

    fireEvent.click(await screen.findByRole('button', { name: 'providerPricing.create' }));

    expect(screen.getByText(/5\s*\/\s*M tokens/i)).toBeInTheDocument();
    expect(screen.getByText(/30\s*\/\s*M tokens/i)).toBeInTheDocument();
  });

  it('submits converted token rates in multiplier mode', async () => {
    const createSpy = vi
      .spyOn(providerPricingService, 'createModelPricingVersion')
      .mockResolvedValue({
        id: 'mpr_test',
        model: 'gpt-5.5',
        provider: 'amux',
      } as ProviderPricingRecord);

    render(
      <PriceVersionModal
        open
        model="gpt-5.5"
        modelType="chat"
        provider="amux"
        scope="global"
        upstreamPricing={{
          currency: 'USD',
          units: [
            { name: 'textInput', rate: 5, strategy: 'fixed', unit: 'millionTokens' },
            { name: 'textOutput', rate: 30, strategy: 'fixed', unit: 'millionTokens' },
          ],
        }}
        onOpenChange={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('providerPricing.price.multiplier.label'), {
      target: { value: '0.5' },
    });
    fireEvent.change(screen.getByPlaceholderText('providerPricing.reason.placeholder'), {
      target: { value: 'set multiplier' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'ok' }));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          inputCreditsPerMillionTokens: 2_500_000,
          outputCreditsPerMillionTokens: 15_000_000,
          providerCost: 35,
          sellRate: 0.5,
        }),
      );
    });
  });

  it('converts manual display token rates before submit', async () => {
    const createSpy = vi
      .spyOn(providerPricingService, 'createModelPricingVersion')
      .mockResolvedValue({
        id: 'mpr_manual',
        model: 'gpt-5.5',
        provider: 'amux',
      } as ProviderPricingRecord);

    render(
      <PriceVersionModal
        open
        model="gpt-5.5"
        modelType="chat"
        provider="amux"
        scope="global"
        onOpenChange={vi.fn()}
      />,
    );

    fireEvent.change(
      screen.getByPlaceholderText('providerPricing.price.inputCredits.placeholder'),
      {
        target: { value: '5' },
      },
    );
    fireEvent.change(
      screen.getByPlaceholderText('providerPricing.price.outputCredits.placeholder'),
      {
        target: { value: '30' },
      },
    );
    fireEvent.change(screen.getByPlaceholderText('providerPricing.reason.placeholder'), {
      target: { value: 'manual converted rates' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'ok' }));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          inputCreditsPerMillionTokens: 5_000_000,
          outputCreditsPerMillionTokens: 30_000_000,
        }),
      );
    });
  });

  it('allows decimal manual token rates before submit', async () => {
    const createSpy = vi
      .spyOn(providerPricingService, 'createModelPricingVersion')
      .mockResolvedValue({
        id: 'mpr_manual_decimal',
        model: 'gpt-5.5',
        provider: 'amux',
      } as ProviderPricingRecord);

    render(
      <PriceVersionModal
        open
        model="gpt-5.5"
        modelType="chat"
        provider="amux"
        scope="global"
        onOpenChange={vi.fn()}
      />,
    );

    const inputPrice = screen.getByPlaceholderText(
      'providerPricing.price.inputCredits.placeholder',
    );
    const outputPrice = screen.getByPlaceholderText(
      'providerPricing.price.outputCredits.placeholder',
    );

    expect(inputPrice).toHaveAttribute('min', '0.001');
    expect(inputPrice).toHaveAttribute('step', '0.001');
    expect(inputPrice).toHaveAttribute('data-precision', '6');

    fireEvent.change(inputPrice, {
      target: { value: '0.435' },
    });
    fireEvent.change(outputPrice, {
      target: { value: '1.4' },
    });
    fireEvent.change(screen.getByPlaceholderText('providerPricing.reason.placeholder'), {
      target: { value: 'manual decimal rates' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'ok' }));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          inputCreditsPerMillionTokens: 435_000,
          outputCreditsPerMillionTokens: 1_400_000,
        }),
      );
    });
  });

  it('shows readonly summary without create controls', async () => {
    vi.spyOn(providerPricingService, 'listModelPricing').mockResolvedValue([
      {
        effectiveAt: '2026-01-01T00:00:00.000Z',
        id: 'price-1',
        inputCreditsPerMillionTokens: 10_000_000,
        model: 'gpt-4o',
        outputCreditsPerMillionTokens: 20_000_000,
        provider: 'newapi-openai-relay',
        status: 'active',
      },
    ]);

    render(
      <ProviderPricing readonly model="gpt-4o" provider="newapi-openai-relay" scope="user" />,
      { wrapper: withSWR },
    );

    await waitFor(() => {
      expect(screen.getByText('providerPricing.current')).toBeInTheDocument();
    });

    expect(screen.getByText('providerPricing.readonly')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'providerPricing.create' }),
    ).not.toBeInTheDocument();
  });

  it('shows create action for global admin scope', async () => {
    vi.spyOn(providerPricingService, 'listModelPricing').mockResolvedValue([]);

    render(<ProviderPricing model="gpt-4o" provider="newapi-openai-relay" scope="global" />, {
      wrapper: withSWR,
    });

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
        inputCreditsPerMillionTokens: 10_000_000,
        model: 'gpt-4o',
        provider: 'newapi-openai-relay',
        status: 'active',
      },
      {
        effectiveAt: '2026-02-01T00:00:00.000Z',
        id: 'future-price',
        inputCreditsPerMillionTokens: 12_000_000,
        model: 'gpt-4o',
        provider: 'newapi-openai-relay',
        status: 'active',
      },
      {
        effectiveAt: '2025-12-01T00:00:00.000Z',
        id: 'past-active-price',
        inputCreditsPerMillionTokens: 8_000_000,
        model: 'gpt-4o',
        provider: 'newapi-openai-relay',
        status: 'active',
      },
      {
        effectiveAt: '2025-11-01T00:00:00.000Z',
        id: 'retired-price',
        inputCreditsPerMillionTokens: 6_000_000,
        model: 'gpt-4o',
        provider: 'newapi-openai-relay',
        status: 'retired',
      },
    ]);

    render(
      <ProviderPricing readonly model="gpt-4o" provider="newapi-openai-relay" scope="global" />,
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

    render(<ProviderPricing model="gpt-4o" provider="newapi-openai-relay" scope="global" />, {
      wrapper: withSWR,
    });

    fireEvent.click(await screen.findByRole('button', { name: 'providerPricing.create' }));
    const okButton = screen.getByRole('button', { name: 'ok' });

    fireEvent.change(screen.getByPlaceholderText('providerPricing.reason.placeholder'), {
      target: { value: 'initial price' },
    });

    expect(okButton).toBeDisabled();
    expect(create).not.toHaveBeenCalled();

    const inputPrice = screen.getByPlaceholderText(
      'providerPricing.price.inputCredits.placeholder',
    );

    expect(inputPrice).toHaveAttribute('min', '0.001');
    expect(inputPrice).toHaveAttribute('step', '0.001');
    expect(inputPrice).toHaveAttribute('data-precision', '6');

    fireEvent.change(inputPrice, {
      target: { value: '0' },
    });

    expect(okButton).toBeDisabled();
    expect(create).not.toHaveBeenCalled();

    fireEvent.change(inputPrice, {
      target: { value: '10' },
    });

    fireEvent.change(
      screen.getByPlaceholderText('providerPricing.price.outputCredits.placeholder'),
      {
        target: { value: '20' },
      },
    );

    await waitFor(() => {
      expect(okButton).not.toBeDisabled();
    });

    fireEvent.click(okButton);

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith({
        currency: 'CNY',
        fixedCreditsPerUnit: undefined,
        inputCreditsPerMillionTokens: 10_000_000,
        modality: 'text',
        model: 'gpt-4o',
        outputCreditsPerMillionTokens: 20_000_000,
        provider: 'newapi-openai-relay',
        reason: 'initial price',
        scope: 'global',
        unit: undefined,
      });
    });
  });

  it('creates text model pricing with token fields only and fixed CNY currency', async () => {
    vi.spyOn(providerPricingService, 'listModelPricing').mockResolvedValue([]);
    const create = vi.spyOn(providerPricingService, 'createModelPricingVersion').mockResolvedValue({
      id: 'price-text',
      model: 'gpt-4o',
      provider: 'newapi-openai-relay',
    });

    render(
      <ProviderPricing
        model="gpt-4o"
        modelType="chat"
        provider="newapi-openai-relay"
        scope="global"
      />,
      { wrapper: withSWR },
    );

    fireEvent.click(await screen.findByRole('button', { name: 'providerPricing.create' }));

    expect(screen.queryByText('providerPricing.price.currency')).not.toBeInTheDocument();
    expect(screen.queryByText('providerPricing.price.modality')).not.toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText('providerPricing.price.fixedCredits.placeholder'),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('providerPricing.reason.placeholder'), {
      target: { value: 'text price' },
    });
    fireEvent.change(
      screen.getByPlaceholderText('providerPricing.price.inputCredits.placeholder'),
      {
        target: { value: '10' },
      },
    );
    fireEvent.change(
      screen.getByPlaceholderText('providerPricing.price.outputCredits.placeholder'),
      {
        target: { value: '20' },
      },
    );

    fireEvent.click(screen.getByRole('button', { name: 'ok' }));

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith({
        currency: 'CNY',
        fixedCreditsPerUnit: undefined,
        inputCreditsPerMillionTokens: 10_000_000,
        modality: 'text',
        model: 'gpt-4o',
        outputCreditsPerMillionTokens: 20_000_000,
        provider: 'newapi-openai-relay',
        reason: 'text price',
        scope: 'global',
        unit: undefined,
      });
    });
  });

  it('creates image fixed pricing without token fields', async () => {
    vi.spyOn(providerPricingService, 'listModelPricing').mockResolvedValue([]);
    const create = vi.spyOn(providerPricingService, 'createModelPricingVersion').mockResolvedValue({
      id: 'price-image',
      model: 'dall-e-3',
      provider: 'openai',
    });

    render(
      <ProviderPricing model="dall-e-3" modelType="image" provider="openai" scope="global" />,
      {
        wrapper: withSWR,
      },
    );

    fireEvent.click(await screen.findByRole('button', { name: 'providerPricing.create' }));
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'fixed' } });

    expect(
      screen.queryByPlaceholderText('providerPricing.price.inputCredits.placeholder'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText('providerPricing.price.outputCredits.placeholder'),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('providerPricing.reason.placeholder'), {
      target: { value: 'image price' },
    });
    fireEvent.change(
      screen.getByPlaceholderText('providerPricing.price.fixedCredits.image.placeholder'),
      {
        target: { value: '30' },
      },
    );

    fireEvent.click(screen.getByRole('button', { name: 'ok' }));

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith({
        currency: 'CNY',
        fixedCreditsPerUnit: 30,
        inputCreditsPerMillionTokens: undefined,
        modality: 'image',
        model: 'dall-e-3',
        outputCreditsPerMillionTokens: undefined,
        provider: 'openai',
        reason: 'image price',
        scope: 'global',
        unit: 'image',
      });
    });
  });

  it('creates video model pricing with token fields only', async () => {
    vi.spyOn(providerPricingService, 'listModelPricing').mockResolvedValue([]);
    const create = vi.spyOn(providerPricingService, 'createModelPricingVersion').mockResolvedValue({
      id: 'price-video',
      model: 'sora',
      provider: 'openai',
    });

    render(<ProviderPricing model="sora" modelType="video" provider="openai" scope="global" />, {
      wrapper: withSWR,
    });

    fireEvent.click(await screen.findByRole('button', { name: 'providerPricing.create' }));

    expect(
      screen.queryByPlaceholderText('providerPricing.price.fixedCredits.placeholder'),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('providerPricing.reason.placeholder'), {
      target: { value: 'video price' },
    });
    fireEvent.change(
      screen.getByPlaceholderText('providerPricing.price.inputCredits.placeholder'),
      {
        target: { value: '40' },
      },
    );
    fireEvent.change(
      screen.getByPlaceholderText('providerPricing.price.outputCredits.placeholder'),
      {
        target: { value: '50' },
      },
    );

    fireEvent.click(screen.getByRole('button', { name: 'ok' }));

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith({
        currency: 'CNY',
        fixedCreditsPerUnit: undefined,
        inputCreditsPerMillionTokens: 40_000_000,
        modality: 'video',
        model: 'sora',
        outputCreditsPerMillionTokens: 50_000_000,
        provider: 'openai',
        reason: 'video price',
        scope: 'global',
        unit: undefined,
      });
    });
  });

  it('copies the current price values and submits a scheduled effective date', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-01-01T00:00:00.000Z').getTime());
    vi.spyOn(providerPricingService, 'listModelPricing').mockResolvedValue([
      {
        currency: 'CNY',
        effectiveAt: '2025-12-01T00:00:00.000Z',
        fixedCreditsPerUnit: 3,
        id: 'current-price',
        inputCreditsPerMillionTokens: 10_000_000,
        model: 'gpt-4o',
        outputCreditsPerMillionTokens: 20_000_000,
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
      <ProviderPricing
        model="gpt-4o"
        modelType="chat"
        provider="newapi-openai-relay"
        scope="global"
      />,
      { wrapper: withSWR },
    );

    await screen.findByText('providerPricing.current');

    fireEvent.click(screen.getByRole('button', { name: 'providerPricing.create' }));

    expect(
      screen.getByPlaceholderText('providerPricing.price.inputCredits.placeholder'),
    ).toHaveValue(10);
    expect(
      screen.getByPlaceholderText('providerPricing.price.outputCredits.placeholder'),
    ).toHaveValue(20);
    expect(
      screen.queryByPlaceholderText('providerPricing.price.fixedCredits.placeholder'),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('providerPricing.reason.placeholder'), {
      target: { value: 'scheduled price' },
    });
    fireEvent.change(screen.getByPlaceholderText('providerPricing.effectiveAt.placeholder'), {
      target: { value: '2026-02-01' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'ok' }));

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith({
        currency: 'CNY',
        effectiveAt: new Date('2026-02-01T00:00:00.000Z'),
        fixedCreditsPerUnit: undefined,
        inputCreditsPerMillionTokens: 10_000_000,
        modality: 'text',
        model: 'gpt-4o',
        outputCreditsPerMillionTokens: 20_000_000,
        provider: 'newapi-openai-relay',
        reason: 'scheduled price',
        scope: 'global',
        unit: undefined,
      });
    });
  });

  it('shows feedback when creating a pricing version fails', async () => {
    vi.spyOn(providerPricingService, 'listModelPricing').mockResolvedValue([]);
    const error = new Error('create failed');
    vi.spyOn(providerPricingService, 'createModelPricingVersion').mockRejectedValue(error);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<ProviderPricing model="gpt-4o" provider="newapi-openai-relay" scope="global" />, {
      wrapper: withSWR,
    });

    fireEvent.click(await screen.findByRole('button', { name: 'providerPricing.create' }));
    fireEvent.change(screen.getByPlaceholderText('providerPricing.reason.placeholder'), {
      target: { value: 'initial price' },
    });
    fireEvent.change(
      screen.getByPlaceholderText('providerPricing.price.inputCredits.placeholder'),
      {
        target: { value: '10' },
      },
    );
    fireEvent.change(
      screen.getByPlaceholderText('providerPricing.price.outputCredits.placeholder'),
      {
        target: { value: '20' },
      },
    );

    const okButton = screen.getByRole('button', { name: 'ok' });

    await waitFor(() => {
      expect(okButton).not.toBeDisabled();
    });

    fireEvent.click(okButton);

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        '[providerPricing:createModelPricingVersion]',
        error,
      );
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
    expect(
      screen.queryByRole('button', { name: 'providerPricing.create' }),
    ).not.toBeInTheDocument();
  });
});
