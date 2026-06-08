import { and, desc, eq, inArray, lt, or } from 'drizzle-orm';

import type { BillingOrderItem, BillingOrderStatus, NewBillingOrder } from '../../schemas';
import { billingOrders } from '../../schemas';
import type { LobeChatDatabase, Transaction } from '../../type';

type BillingDb = LobeChatDatabase | Transaction;

export interface ListBillingOrdersParams {
  cursor?: string;
  pageSize: number;
  statuses?: BillingOrderStatus[];
}

export class BillingOrderModel {
  private readonly db: BillingDb;
  private readonly userId: string;

  constructor(db: BillingDb, userId: string) {
    this.db = db;
    this.userId = userId;
  }

  create = async (params: Omit<NewBillingOrder, 'userId'>): Promise<BillingOrderItem> => {
    const [order] = await this.db
      .insert(billingOrders)
      .values({ ...params, userId: this.userId })
      .returning();

    return order;
  };

  findById = async (orderId: string): Promise<BillingOrderItem | null> => {
    const [order] = await this.db
      .select()
      .from(billingOrders)
      .where(and(eq(billingOrders.id, orderId), eq(billingOrders.userId, this.userId)))
      .limit(1);

    return order ?? null;
  };

  closePending = async (orderId: string): Promise<BillingOrderItem | null> => {
    const [order] = await this.db
      .update(billingOrders)
      .set({ status: 'closed', updatedAt: new Date() })
      .where(
        and(
          eq(billingOrders.id, orderId),
          eq(billingOrders.userId, this.userId),
          eq(billingOrders.status, 'pending'),
        ),
      )
      .returning();

    return order ?? null;
  };

  list = async (
    params: ListBillingOrdersParams,
  ): Promise<{ items: BillingOrderItem[]; nextCursor?: string }> => {
    const conditions = [eq(billingOrders.userId, this.userId)];

    if (params.statuses && params.statuses.length > 0) {
      conditions.push(inArray(billingOrders.status, params.statuses));
    }

    if (params.cursor) {
      const [cursorOrder] = await this.db
        .select({ createdAt: billingOrders.createdAt, id: billingOrders.id })
        .from(billingOrders)
        .where(and(eq(billingOrders.id, params.cursor), eq(billingOrders.userId, this.userId)))
        .limit(1);

      if (cursorOrder) {
        conditions.push(
          or(
            lt(billingOrders.createdAt, cursorOrder.createdAt),
            and(
              eq(billingOrders.createdAt, cursorOrder.createdAt),
              lt(billingOrders.id, cursorOrder.id),
            ),
          )!,
        );
      }
    }

    const items = await this.db
      .select()
      .from(billingOrders)
      .where(and(...conditions))
      .orderBy(desc(billingOrders.createdAt), desc(billingOrders.id))
      .limit(params.pageSize + 1);

    const hasMore = items.length > params.pageSize;
    const pageItems = hasMore ? items.slice(0, params.pageSize) : items;

    return {
      items: pageItems,
      nextCursor: hasMore ? pageItems.at(-1)?.id : undefined,
    };
  };

  updateStatus = async (
    orderId: string,
    params: {
      activatedAt?: Date | null;
      activatedGrantId?: string | null;
      metadata?: Record<string, unknown>;
      paidAt?: Date | null;
      paymentTransactionId?: string | null;
      status: BillingOrderStatus;
    },
  ): Promise<BillingOrderItem | null> => {
    const [order] = await this.db
      .update(billingOrders)
      .set({ ...params, updatedAt: new Date() })
      .where(and(eq(billingOrders.id, orderId), eq(billingOrders.userId, this.userId)))
      .returning();

    return order ?? null;
  };
}
