import { and, desc, eq, lt, or } from 'drizzle-orm';

import type { NewUsageRecord, UsageRecordItem } from '../../schemas';
import { usageRecords } from '../../schemas';
import type { LobeChatDatabase, Transaction } from '../../type';

type BillingDb = LobeChatDatabase | Transaction;

export interface ListUsageRecordsParams {
  cursor?: string;
  pageSize: number;
}

export class UsageRecordModel {
  private readonly db: BillingDb;
  private readonly userId: string;

  constructor(db: BillingDb, userId: string) {
    this.db = db;
    this.userId = userId;
  }

  create = async (params: Omit<NewUsageRecord, 'userId'>): Promise<UsageRecordItem> => {
    const [record] = await this.db
      .insert(usageRecords)
      .values({ ...params, userId: this.userId })
      .returning();

    return record;
  };

  list = async (
    params: ListUsageRecordsParams,
  ): Promise<{ items: UsageRecordItem[]; nextCursor?: string }> => {
    const conditions = [eq(usageRecords.userId, this.userId)];

    if (params.cursor) {
      const [cursorRecord] = await this.db
        .select({ createdAt: usageRecords.createdAt, id: usageRecords.id })
        .from(usageRecords)
        .where(and(eq(usageRecords.id, params.cursor), eq(usageRecords.userId, this.userId)))
        .limit(1);

      if (cursorRecord) {
        conditions.push(
          or(
            lt(usageRecords.createdAt, cursorRecord.createdAt),
            and(eq(usageRecords.createdAt, cursorRecord.createdAt), lt(usageRecords.id, cursorRecord.id)),
          )!,
        );
      }
    }

    const items = await this.db
      .select()
      .from(usageRecords)
      .where(and(...conditions))
      .orderBy(desc(usageRecords.createdAt), desc(usageRecords.id))
      .limit(params.pageSize + 1);

    const hasMore = items.length > params.pageSize;
    const pageItems = hasMore ? items.slice(0, params.pageSize) : items;

    return {
      items: pageItems,
      nextCursor: hasMore ? pageItems.at(-1)?.id : undefined,
    };
  };
}
