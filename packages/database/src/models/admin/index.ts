import { desc } from 'drizzle-orm';

import type { LobeChatDatabase } from '@/database/type';

import type { AdminOperationAction } from '../../schemas/admin';
import { adminOperationLogs } from '../../schemas/admin';

export class AdminModel {
  private db: LobeChatDatabase;
  private operatorId: string;

  constructor(db: LobeChatDatabase, operatorId: string) {
    this.db = db;
    this.operatorId = operatorId;
  }

  logOperation = async (params: {
    targetUserId: string;
    action: AdminOperationAction;
    beforeValue?: Record<string, unknown>;
    afterValue?: Record<string, unknown>;
    note?: string;
  }) => {
    const [record] = await this.db
      .insert(adminOperationLogs)
      .values({ operatorId: this.operatorId, ...params })
      .returning();

    return record;
  };

  listLogs = async (limit = 50, offset = 0) =>
    this.db
      .select()
      .from(adminOperationLogs)
      .orderBy(desc(adminOperationLogs.createdAt))
      .limit(limit)
      .offset(offset);
}
