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

  it('lists only billing orders matching requested statuses', async () => {
    const model = new BillingOrderModel(serverDB, userId);

    const pendingOrder = await model.create({
      amountCents: 9900,
      credits: 1_000_000,
      currency: 'CNY',
      orderType: 'top_up',
      paymentChannel: 'alipay',
      status: 'pending',
    });
    const paidOrder = await model.create({
      amountCents: 9900,
      credits: 1_000_000,
      currency: 'CNY',
      orderType: 'top_up',
      paymentChannel: 'alipay',
      status: 'paid',
    });
    const activatedOrder = await model.create({
      amountCents: 9900,
      credits: 1_000_000,
      currency: 'CNY',
      orderType: 'subscription_new',
      paymentChannel: 'wechat',
      status: 'activated',
    });
    const closedOrder = await model.create({
      amountCents: 9900,
      credits: 1_000_000,
      currency: 'CNY',
      orderType: 'top_up',
      paymentChannel: 'alipay',
      status: 'closed',
    });

    const listed = await model.list({ pageSize: 10, statuses: ['paid', 'activated'] });

    expect(listed.items.map((item) => item.id).sort()).toEqual(
      [activatedOrder.id, paidOrder.id].sort(),
    );
    expect(listed.items.map((item) => item.id)).not.toContain(pendingOrder.id);
    expect(listed.items.map((item) => item.id)).not.toContain(closedOrder.id);
    expect(
      listed.items.every((item) => item.status === 'paid' || item.status === 'activated'),
    ).toBe(true);
  });

  it('applies status filters while paginating billing orders by cursor', async () => {
    const model = new BillingOrderModel(serverDB, userId);

    await serverDB.insert(billingOrders).values([
      {
        amountCents: 9900,
        createdAt: new Date('2026-06-04T00:00:00.000Z'),
        credits: 1_000_000,
        currency: 'CNY',
        id: 'order-pending-newer',
        orderType: 'top_up',
        paymentChannel: 'alipay',
        status: 'pending',
        userId,
      },
      {
        amountCents: 9900,
        createdAt: new Date('2026-06-03T00:00:00.000Z'),
        credits: 1_000_000,
        currency: 'CNY',
        id: 'order-paid-first',
        orderType: 'top_up',
        paymentChannel: 'alipay',
        status: 'paid',
        userId,
      },
      {
        amountCents: 9900,
        createdAt: new Date('2026-06-02T00:00:00.000Z'),
        credits: 1_000_000,
        currency: 'CNY',
        id: 'order-activated-second',
        orderType: 'subscription_new',
        paymentChannel: 'wechat',
        status: 'activated',
        userId,
      },
      {
        amountCents: 9900,
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
        credits: 1_000_000,
        currency: 'CNY',
        id: 'order-closed-older',
        orderType: 'top_up',
        paymentChannel: 'alipay',
        status: 'closed',
        userId,
      },
    ]);

    const firstPage = await model.list({ pageSize: 1, statuses: ['paid', 'activated'] });
    const secondPage = await model.list({
      cursor: firstPage.nextCursor,
      pageSize: 1,
      statuses: ['paid', 'activated'],
    });

    expect(firstPage).toMatchObject({
      items: [{ id: 'order-paid-first', status: 'paid' }],
      nextCursor: 'order-paid-first',
    });
    expect(secondPage).toMatchObject({
      items: [{ id: 'order-activated-second', status: 'activated' }],
      nextCursor: undefined,
    });
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
