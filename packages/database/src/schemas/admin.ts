import { index, jsonb, pgTable, text } from 'drizzle-orm/pg-core';

import { idGenerator } from '../utils/idGenerator';
import { timestamptz } from './_helpers';
import { users } from './user';

export type AdminOperationAction =
  | 'credit_grant'
  | 'credit_revoke'
  | 'batch_credit_grant'
  | 'account_ban'
  | 'account_unban';

export const adminOperationLogs = pgTable(
  'admin_operation_logs',
  {
    id: text('id')
      .$defaultFn(() => idGenerator('adminOperationLogs'))
      .primaryKey()
      .notNull(),
    operatorId: text('operator_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    targetUserId: text('target_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    action: text('action').$type<AdminOperationAction>().notNull(),
    beforeValue: jsonb('before_value').$type<Record<string, unknown>>(),
    afterValue: jsonb('after_value').$type<Record<string, unknown>>(),
    note: text('note'),
    createdAt: timestamptz('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('admin_op_logs_operator_idx').on(t.operatorId),
    index('admin_op_logs_target_idx').on(t.targetUserId),
    index('admin_op_logs_action_idx').on(t.action),
    index('admin_op_logs_created_idx').on(t.createdAt),
  ],
);

export type AdminOperationLogItem = typeof adminOperationLogs.$inferSelect;
export type NewAdminOperationLog = typeof adminOperationLogs.$inferInsert;
