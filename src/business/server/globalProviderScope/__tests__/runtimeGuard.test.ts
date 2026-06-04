import { ModelProvider } from 'model-bank';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PricingNotFoundError } from '@/business/server/billing/errors';
import { GLOBAL_PROVIDER_CONFIG_USER_ID } from '@/business/server/globalProviderScope/constants';

import {
  assertGlobalProviderModelAvailable,
  PLATFORM_MODEL_CREDENTIAL_MISSING,
  PLATFORM_MODEL_DISABLED,
  PLATFORM_PROVIDER_DISABLED,
} from '../runtimeGuard';

const { decryptedKeyVaults, findActivePricing, getUserKeyVaults } = vi.hoisted(() => ({
  decryptedKeyVaults: new Map<string, unknown>(),
  findActivePricing: vi.fn(),
  getUserKeyVaults: vi.fn(async (keyVaults: unknown) => {
    if (typeof keyVaults === 'string') return decryptedKeyVaults.get(keyVaults) ?? {};

    return keyVaults ?? {};
  }),
}));

vi.mock('@/server/modules/KeyVaultsEncrypt', () => ({
  KeyVaultsGateKeeper: { getUserKeyVaults },
}));

vi.mock('@/business/server/billing/pricing', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/business/server/billing/pricing')>();

  return {
    ...original,
    ModelPricingService: vi.fn().mockImplementation(() => ({ findActivePricing })),
  };
});

vi.mock('drizzle-orm', async (importOriginal) => {
  const original = await importOriginal<typeof import('drizzle-orm')>();

  return {
    ...original,
    and: vi.fn((...conditions) => conditions),
    eq: vi.fn((field, value) => ({ field, value })),
  };
});

const createSelectQuery = (rows: unknown[]) => ({
  from: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue(rows),
  where: vi.fn().mockReturnThis(),
});

describe('assertGlobalProviderModelAvailable', () => {
  const db = { select: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    decryptedKeyVaults.clear();
    db.select.mockReset();
    findActivePricing.mockResolvedValue({ id: 'price-1' });
  });

  it('allows enabled global provider and model with credentials', async () => {
    db.select
      .mockReturnValueOnce(createSelectQuery([{ enabled: true, keyVaults: { apiKey: 'sk-test' } }]))
      .mockReturnValueOnce(createSelectQuery([{ enabled: true }]));

    await expect(
      assertGlobalProviderModelAvailable({
        db: db as never,
        model: 'gpt-4o',
        provider: 'newapi-openai-relay',
      }),
    ).resolves.toBeUndefined();

    expect(db.select).toHaveBeenCalledTimes(2);
  });

  it('fails closed when the global provider row is missing or disabled', async () => {
    db.select.mockReturnValueOnce(createSelectQuery([]));

    await expect(
      assertGlobalProviderModelAvailable({
        db: db as never,
        model: 'gpt-4o',
        provider: 'newapi-openai-relay',
      }),
    ).rejects.toMatchObject({ code: PLATFORM_PROVIDER_DISABLED });
  });

  it('fails closed when the global model row is missing or disabled', async () => {
    db.select
      .mockReturnValueOnce(createSelectQuery([{ enabled: true, keyVaults: { apiKey: 'sk-test' } }]))
      .mockReturnValueOnce(createSelectQuery([{ enabled: false }]));

    await expect(
      assertGlobalProviderModelAvailable({
        db: db as never,
        model: 'gpt-4o',
        provider: 'newapi-openai-relay',
      }),
    ).rejects.toMatchObject({ code: PLATFORM_MODEL_DISABLED });
  });

  it('requires provider credentials in global platform scope', async () => {
    db.select
      .mockReturnValueOnce(createSelectQuery([{ enabled: true, keyVaults: {} }]))
      .mockReturnValueOnce(createSelectQuery([{ enabled: true }]));

    await expect(
      assertGlobalProviderModelAvailable({
        db: db as never,
        model: 'gpt-4o',
        provider: 'newapi-openai-relay',
      }),
    ).rejects.toMatchObject({ code: PLATFORM_MODEL_CREDENTIAL_MISSING });
  });

  it('rejects raw encrypted provider keyVaults when decrypted global keyVaults are empty', async () => {
    decryptedKeyVaults.set('encrypted-non-empty-key-vaults', {});
    db.select
      .mockReturnValueOnce(createSelectQuery([{ enabled: true, keyVaults: 'encrypted-non-empty-key-vaults' }]))
      .mockReturnValueOnce(createSelectQuery([{ enabled: true }]));

    await expect(
      assertGlobalProviderModelAvailable({
        db: db as never,
        model: 'gpt-4o',
        provider: 'newapi-openai-relay',
      }),
    ).rejects.toMatchObject({ code: PLATFORM_MODEL_CREDENTIAL_MISSING });
  });

  it('allows raw encrypted provider keyVaults when decrypted provider-specific credentials are present', async () => {
    decryptedKeyVaults.set('encrypted-non-empty-key-vaults', {
      apiKey: 'cf-api-key',
      baseURLOrAccountID: 'account-id',
    });
    db.select
      .mockReturnValueOnce(
        createSelectQuery([
          {
            enabled: true,
            keyVaults: 'encrypted-non-empty-key-vaults',
            settings: { sdkType: ModelProvider.Cloudflare },
          },
        ]),
      )
      .mockReturnValueOnce(createSelectQuery([{ enabled: true }]));

    await expect(
      assertGlobalProviderModelAvailable({
        db: db as never,
        model: '@cf/meta/llama-3.1-8b-instruct',
        provider: 'custom-cloudflare-relay',
      }),
    ).resolves.toBeUndefined();
  });

  it('rejects OpenAI-compatible baseURL-only provider credentials', async () => {
    db.select.mockReturnValueOnce(
      createSelectQuery([{ enabled: true, keyVaults: { baseURL: 'https://api.example.test/v1' } }]),
    );

    await expect(
      assertGlobalProviderModelAvailable({
        db: db as never,
        model: 'gpt-4o',
        provider: 'newapi-openai-relay',
      }),
    ).rejects.toMatchObject({ code: PLATFORM_MODEL_CREDENTIAL_MISSING });
  });

  it('allows Ollama baseURL-only provider credentials', async () => {
    db.select
      .mockReturnValueOnce(createSelectQuery([{ enabled: true, keyVaults: { baseURL: 'http://127.0.0.1:11434' } }]))
      .mockReturnValueOnce(createSelectQuery([{ enabled: true }]));

    await expect(
      assertGlobalProviderModelAvailable({
        db: db as never,
        model: 'llama3.1',
        provider: ModelProvider.Ollama,
      }),
    ).resolves.toBeUndefined();
  });

  it('requires both Bedrock access key id and secret access key', async () => {
    for (const keyVaults of [{ accessKeyId: 'aws-access-key-id' }, { secretAccessKey: 'aws-secret-access-key' }]) {
      db.select.mockReturnValueOnce(createSelectQuery([{ enabled: true, keyVaults }]));

      await expect(
        assertGlobalProviderModelAvailable({
          db: db as never,
          model: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
          provider: ModelProvider.Bedrock,
        }),
      ).rejects.toMatchObject({ code: PLATFORM_MODEL_CREDENTIAL_MISSING });
    }

    db.select
      .mockReturnValueOnce(
        createSelectQuery([
          {
            enabled: true,
            keyVaults: { accessKeyId: 'aws-access-key-id', secretAccessKey: 'aws-secret-access-key' },
          },
        ]),
      )
      .mockReturnValueOnce(createSelectQuery([{ enabled: true }]));

    await expect(
      assertGlobalProviderModelAvailable({
        db: db as never,
        model: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
        provider: ModelProvider.Bedrock,
      }),
    ).resolves.toBeUndefined();
  });

  it('rejects Cloudflare account-only provider credentials', async () => {
    db.select.mockReturnValueOnce(
      createSelectQuery([{ enabled: true, keyVaults: { baseURLOrAccountID: 'account-id' } }]),
    );

    await expect(
      assertGlobalProviderModelAvailable({
        db: db as never,
        model: '@cf/meta/llama-3.1-8b-instruct',
        provider: ModelProvider.Cloudflare,
      }),
    ).rejects.toMatchObject({ code: PLATFORM_MODEL_CREDENTIAL_MISSING });
  });

  it('validates custom Cloudflare provider credentials using sdkType', async () => {
    db.select.mockReturnValueOnce(
      createSelectQuery([
        {
          enabled: true,
          keyVaults: { baseURLOrAccountID: 'account-id' },
          settings: { sdkType: ModelProvider.Cloudflare },
        },
      ]),
    );

    await expect(
      assertGlobalProviderModelAvailable({
        db: db as never,
        model: '@cf/meta/llama-3.1-8b-instruct',
        provider: 'custom-cloudflare-relay',
      }),
    ).rejects.toMatchObject({ code: PLATFORM_MODEL_CREDENTIAL_MISSING });

    db.select
      .mockReturnValueOnce(
        createSelectQuery([
          {
            enabled: true,
            keyVaults: { apiKey: 'cf-api-key', baseURLOrAccountID: 'account-id' },
            settings: { sdkType: ModelProvider.Cloudflare },
          },
        ]),
      )
      .mockReturnValueOnce(createSelectQuery([{ enabled: true }]));

    await expect(
      assertGlobalProviderModelAvailable({
        db: db as never,
        model: '@cf/meta/llama-3.1-8b-instruct',
        provider: 'custom-cloudflare-relay',
      }),
    ).resolves.toBeUndefined();
  });

  it('allows custom Ollama baseURL-only provider credentials using sdkType', async () => {
    db.select
      .mockReturnValueOnce(
        createSelectQuery([
          {
            enabled: true,
            keyVaults: { baseURL: 'http://127.0.0.1:11434' },
            settings: { sdkType: ModelProvider.Ollama },
          },
        ]),
      )
      .mockReturnValueOnce(createSelectQuery([{ enabled: true }]));

    await expect(
      assertGlobalProviderModelAvailable({
        db: db as never,
        model: 'llama3.1',
        provider: 'custom-ollama-lab',
      }),
    ).resolves.toBeUndefined();
  });

  it('validates custom Bedrock provider credentials using sdkType', async () => {
    db.select.mockReturnValueOnce(
      createSelectQuery([
        {
          enabled: true,
          keyVaults: { secretAccessKey: 'aws-secret-access-key' },
          settings: { sdkType: ModelProvider.Bedrock },
        },
      ]),
    );

    await expect(
      assertGlobalProviderModelAvailable({
        db: db as never,
        model: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
        provider: 'custom-bedrock-relay',
      }),
    ).rejects.toMatchObject({ code: PLATFORM_MODEL_CREDENTIAL_MISSING });
  });

  it('validates ComfyUI credentials by auth type', async () => {
    db.select
      .mockReturnValueOnce(
        createSelectQuery([
          { enabled: true, keyVaults: { authType: 'none', baseURL: 'http://127.0.0.1:8000' } },
        ]),
      )
      .mockReturnValueOnce(createSelectQuery([{ enabled: true }]));

    await expect(
      assertGlobalProviderModelAvailable({
        db: db as never,
        model: 'flux-dev',
        provider: ModelProvider.ComfyUI,
      }),
    ).resolves.toBeUndefined();

    for (const keyVaults of [
      { authType: 'bearer', baseURL: 'http://127.0.0.1:8000' },
      { authType: 'basic', baseURL: 'http://127.0.0.1:8000' },
      { authType: 'custom', baseURL: 'http://127.0.0.1:8000' },
    ]) {
      db.select.mockReturnValueOnce(createSelectQuery([{ enabled: true, keyVaults }]));

      await expect(
        assertGlobalProviderModelAvailable({
          db: db as never,
          model: 'flux-dev',
          provider: ModelProvider.ComfyUI,
        }),
      ).rejects.toMatchObject({ code: PLATFORM_MODEL_CREDENTIAL_MISSING });
    }
  });

  it('requires VertexAI api key or service-account JSON credentials', async () => {
    db.select.mockReturnValueOnce(
      createSelectQuery([
        { enabled: true, keyVaults: { baseURL: 'https://vertex.example.test', region: 'us-central1' } },
      ]),
    );

    await expect(
      assertGlobalProviderModelAvailable({
        db: db as never,
        model: 'gemini-2.5-pro',
        provider: ModelProvider.VertexAI,
      }),
    ).rejects.toMatchObject({ code: PLATFORM_MODEL_CREDENTIAL_MISSING });

    db.select
      .mockReturnValueOnce(
        createSelectQuery([
          { enabled: true, keyVaults: { apiKey: '{"project_id":"test-project"}', region: 'us-central1' } },
        ]),
      )
      .mockReturnValueOnce(createSelectQuery([{ enabled: true }]));

    await expect(
      assertGlobalProviderModelAvailable({
        db: db as never,
        model: 'gemini-2.5-pro',
        provider: ModelProvider.VertexAI,
      }),
    ).resolves.toBeUndefined();
  });

  it('uses active DB pricing for the provider instance when pricing is required', async () => {
    db.select
      .mockReturnValueOnce(createSelectQuery([{ enabled: true, keyVaults: { apiKey: 'sk-test' } }]))
      .mockReturnValueOnce(createSelectQuery([{ enabled: true }]));

    await assertGlobalProviderModelAvailable({
      db: db as never,
      modality: 'image',
      model: 'gpt-4o-image',
      provider: 'newapi-openai-relay',
      requirePricing: true,
    });

    expect(findActivePricing).toHaveBeenCalledWith({
      modality: 'image',
      model: 'gpt-4o-image',
      provider: 'newapi-openai-relay',
    });
  });

  it('does not hide current pricing lookup failures', async () => {
    db.select
      .mockReturnValueOnce(createSelectQuery([{ enabled: true, keyVaults: { apiKey: 'sk-test' } }]))
      .mockReturnValueOnce(createSelectQuery([{ enabled: true }]));
    findActivePricing.mockRejectedValue(
      new PricingNotFoundError({ modality: 'video', model: 'sora', provider: 'newapi-video-relay' }),
    );

    await expect(
      assertGlobalProviderModelAvailable({
        db: db as never,
        modality: 'video',
        model: 'sora',
        provider: 'newapi-video-relay',
        requirePricing: true,
      }),
    ).rejects.toMatchObject({ code: 'PRICING_NOT_FOUND' });
  });

  it('queries global provider scope rather than the caller user scope', async () => {
    const providerQuery = createSelectQuery([{ enabled: true, keyVaults: { apiKey: 'sk-test' } }]);
    db.select.mockReturnValueOnce(providerQuery).mockReturnValueOnce(createSelectQuery([{ enabled: true }]));

    await assertGlobalProviderModelAvailable({
      db: db as never,
      model: 'gpt-4o',
      provider: 'newapi-openai-relay',
    });

    expect(providerQuery.where).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ value: 'newapi-openai-relay' }),
        expect.objectContaining({ value: GLOBAL_PROVIDER_CONFIG_USER_ID }),
      ]),
    );
  });
});
