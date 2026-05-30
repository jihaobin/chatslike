import type { ChatStreamPayload, ModelRuntimeHooks, OnFinishData } from '@lobechat/model-runtime';
import debug from 'debug';

import { getServerDB } from '@/database/core/db-adaptor';

import { CreditsService } from '@/business/server/billing/credits';
import {
  calculateTextCredits,
  estimateTextCreditsForRequest,
  getTextPricing,
} from '@/business/server/billing/pricing';
import { assertPrechargeRisk } from '@/business/server/billing/risk';

const ESTIMATED_CHARS_PER_TOKEN = 4;
const log = debug('lobe-server:billing:model-runtime');

interface RuntimeBillingState {
  estimatedCredits: number;
  inputCreditsPerMillionTokens: number;
  operationId: string;
  outputCreditsPerMillionTokens: number;
  reservationId: string;
}

const createOperationId = (userId: string, provider: string, model: string) => {
  const now = Date.now();
  const suffix =
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);

  return `chat:${userId}:${provider}:${model}:${now}:${suffix}`;
};

const estimatePromptTokens = (payload: ChatStreamPayload) =>
  Math.ceil(JSON.stringify(payload.messages).length / ESTIMATED_CHARS_PER_TOKEN);

const getActualTextCredits = (
  data: OnFinishData,
  pricing: Pick<RuntimeBillingState, 'inputCreditsPerMillionTokens' | 'outputCreditsPerMillionTokens'>,
) => {
  const { inputTokens, outputTokens } = getTextUsageTokens(data);

  return calculateTextCredits({
    inputCreditsPerMillionTokens: pricing.inputCreditsPerMillionTokens,
    inputTokens,
    outputCreditsPerMillionTokens: pricing.outputCreditsPerMillionTokens,
    outputTokens,
  });
};

const getTextUsageTokens = (data: OnFinishData) => {
  const usage = data.usage;

  return {
    inputTokens: usage?.inputTextTokens ?? usage?.totalInputTokens ?? 0,
    outputTokens: usage?.outputTextTokens ?? usage?.totalOutputTokens ?? 0,
  };
};

export function getBusinessModelRuntimeHooks(
  userId: string,
  provider: string,
): ModelRuntimeHooks | undefined {
  if (!userId || !provider) return undefined;

  const billingState = new WeakMap<ChatStreamPayload, RuntimeBillingState>();

  return {
    async beforeChat(payload) {
      const db = await getServerDB();
      const service = new CreditsService(db, userId);
      const operationId = createOperationId(userId, provider, payload.model);
      const pricing = await getTextPricing({ model: payload.model, provider });
      const estimatedCredits = estimateTextCreditsForRequest({
        inputCreditsPerMillionTokens: pricing.inputCreditsPerMillionTokens,
        maxOutputTokens: payload.max_tokens,
        outputCreditsPerMillionTokens: pricing.outputCreditsPerMillionTokens,
        promptTokensEstimate: estimatePromptTokens(payload),
      });

      await assertPrechargeRisk({ db, estimatedCredits, userId });

      const reservation = await service.reserveUsageCredits({
        businessType: 'text',
        estimatedCredits,
        metadata: { operationId },
        model: payload.model,
        operationId,
        provider,
      });

      billingState.set(payload, {
        estimatedCredits,
        inputCreditsPerMillionTokens: pricing.inputCreditsPerMillionTokens,
        operationId,
        outputCreditsPerMillionTokens: pricing.outputCreditsPerMillionTokens,
        reservationId: reservation.id,
      });
    },

    async onChatError(_error, context) {
      const state = billingState.get(context.payload);
      if (!state) return;

      try {
        const db = await getServerDB();
        const service = new CreditsService(db, userId);
        await service.releaseUsageCredits({
          operationId: `${state.operationId}:release`,
          reason: 'chat_error',
          reservationId: state.reservationId,
        });
        billingState.delete(context.payload);
      } catch (error) {
        log('failed to release chat credits reservation: %O', error);
      }
    },

    async onChatFinal(data, context) {
      const state = billingState.get(context.payload);
      if (!state) return;

      const db = await getServerDB();
      const service = new CreditsService(db, userId);
      const actualCredits = getActualTextCredits(data, state);
      const { inputTokens, outputTokens } = getTextUsageTokens(data);
      const usageRecord = await service.createUsageRecord({
        actualCredits,
        businessId: state.operationId,
        estimatedCredits: state.estimatedCredits,
        inputTokens,
        metadata: {
          finishReason: data.finishReason,
          operationId: state.operationId,
          toolsCalling: data.toolsCalling,
        },
        modality: 'text',
        model: context.payload.model,
        outputTokens,
        overrunCredits: Math.max(actualCredits - state.estimatedCredits, 0),
        params: {
          maxOutputTokens: context.payload.max_tokens,
        },
        provider,
        releasedCredits: Math.max(state.estimatedCredits - actualCredits, 0),
        reservationId: state.reservationId,
        status: 'captured',
      });

      await service.captureUsageCredits({
        actualCredits,
        operationId: `${state.operationId}:capture`,
        reservationId: state.reservationId,
        usageRecordId: usageRecord.id,
      });
      billingState.delete(context.payload);
    },
  };
}
