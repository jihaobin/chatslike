// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '../../core/getTestDB';
import { billingOrders, paymentTransactions, users } from '../../schemas';
import type { LobeChatDatabase } from '../../type';
import { BillingOrderModel, PaymentTransactionModel } from '../billing';

const serverDB: LobeChatDatabase = await getTestDB();
const userId = 'billing-order-payment-user';

beforeEach(async () => {
  await serverDB.delete(users);
  await serverDB.insert(users).values([{ id: userId }]);
});

afterEach(async () => {
  await serverDB.delete(paymentTransactions);
  await serverDB.delete(billingOrders);
  await serverDB.delete(users);
});

describe('billing order and payment transaction models', () => {
  it('creates, finds, lists, and updates a billing order', async () => {
    const model = new BillingOrderModel(serverDB, userId);
    const transactionModel = new PaymentTransactionModel(serverDB);

    const order = await model.create({
      amountCents: 9900,
      credits: 1_000_000,
      currency: 'CNY',
      orderType: 'top_up',
      paymentChannel: 'alipay',
      status: 'pending',
    });

    expect(order.userId).toBe(userId);
    expect(await model.findById(order.id)).toMatchObject({
      amountCents: 9900,
      credits: 1_000_000,
      status: 'pending',
    });

    const listed = await model.list({ pageSize: 10 });
    expect(listed.items.map((item) => item.id)).toEqual([order.id]);

    const paidAt = new Date('2026-05-28T00:00:00.000Z');
    const transaction = await transactionModel.createPending({
      amountCents: 9900,
      billingOrderId: order.id,
      channel: 'alipay',
    });
    const updated = await model.updateStatus(order.id, {
      paidAt,
      paymentTransactionId: transaction.id,
      status: 'paid',
    });

    expect(updated).toMatchObject({
      id: order.id,
      paymentTransactionId: transaction.id,
      status: 'paid',
    });
    expect(updated?.paidAt?.toISOString()).toBe(paidAt.toISOString());

    const closed = await model.closePending(order.id);
    expect(closed).toBeNull();
  });

  it('closes only pending billing orders', async () => {
    const model = new BillingOrderModel(serverDB, userId);

    const order = await model.create({
      amountCents: 9900,
      credits: 1_000_000,
      currency: 'CNY',
      orderType: 'top_up',
      paymentChannel: 'alipay',
      status: 'pending',
    });

    const closed = await model.closePending(order.id);
    expect(closed).toMatchObject({ id: order.id, status: 'closed' });

    await expect(model.closePending(order.id)).resolves.toBeNull();
    await expect(model.findById(order.id)).resolves.toMatchObject({
      id: order.id,
      status: 'closed',
    });
  });

  it('records payment callbacks idempotently by provider transaction id', async () => {
    const orderModel = new BillingOrderModel(serverDB, userId);
    const transactionModel = new PaymentTransactionModel(serverDB);

    const order = await orderModel.create({
      amountCents: 9900,
      credits: 1_000_000,
      currency: 'CNY',
      orderType: 'top_up',
      paymentChannel: 'wechat',
      status: 'pending',
    });

    const transaction = await transactionModel.recordCallback({
      amountCents: 9900,
      amountVerified: true,
      billingOrderId: order.id,
      channel: 'wechat',
      providerTransactionId: 'wechat-tx-1',
      rawCallback: { trade_state: 'SUCCESS' },
      signatureVerified: true,
      status: 'succeeded',
    });
    const same = await transactionModel.recordCallback({
      amountCents: 9900,
      amountVerified: true,
      billingOrderId: order.id,
      channel: 'wechat',
      providerTransactionId: 'wechat-tx-1',
      rawCallback: { trade_state: 'SUCCESS' },
      signatureVerified: true,
      status: 'succeeded',
    });

    expect(same.id).toBe(transaction.id);
    expect(
      await transactionModel.findByProviderTransactionId('wechat', 'wechat-tx-1'),
    ).toMatchObject({
      amountCents: 9900,
      amountVerified: true,
      billingOrderId: order.id,
      channel: 'wechat',
      providerTransactionId: 'wechat-tx-1',
      signatureVerified: true,
      status: 'succeeded',
    });
  });

  it('creates a pending payment transaction and updates it from callback', async () => {
    const orderModel = new BillingOrderModel(serverDB, userId);
    const transactionModel = new PaymentTransactionModel(serverDB);

    const order = await orderModel.create({
      amountCents: 9900,
      credits: 1_000_000,
      currency: 'CNY',
      orderType: 'top_up',
      paymentChannel: 'alipay',
      status: 'pending',
    });

    const pending = await transactionModel.createPending({
      amountCents: 9900,
      billingOrderId: order.id,
      channel: 'alipay',
    });

    expect(pending).toMatchObject({
      billingOrderId: order.id,
      channel: 'alipay',
      providerTransactionId: null,
      status: 'created',
    });

    const callback = await transactionModel.recordCallback({
      amountCents: 9900,
      amountVerified: true,
      billingOrderId: order.id,
      channel: 'alipay',
      providerTransactionId: 'ali-tx-1',
      rawCallback: { trade_status: 'TRADE_SUCCESS' },
      signatureVerified: true,
      status: 'succeeded',
    });

    expect(callback.id).toBe(pending.id);
    expect(callback).toMatchObject({
      amountVerified: true,
      providerTransactionId: 'ali-tx-1',
      signatureVerified: true,
      status: 'succeeded',
    });
  });
});
