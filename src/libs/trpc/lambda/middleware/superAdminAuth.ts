import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import { isSuperAdminRole } from '@/const/authRoles';
import { RbacModel } from '@/database/models/rbac';
import { users } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';

import { trpc } from '../init';

/**
 * Allows through if the user has users.role = 'super-admin' (legacy)
 * OR has the admin:audit_read:all RBAC permission (new system).
 * Must be used after the serverDatabase middleware (which injects ctx.serverDB).
 */
export const superAdminAuth = trpc.middleware(async ({ ctx, next }) => {
  const { serverDB, userId } = ctx as typeof ctx & { serverDB: LobeChatDatabase; userId: string };

  const [userRow] = await serverDB
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId));

  if (isSuperAdminRole(userRow?.role)) return next();

  const rbac = new RbacModel(serverDB, userId);
  const ok = await rbac.hasPermission('admin:audit_read:all');
  if (!ok) throw new TRPCError({ code: 'FORBIDDEN' });

  return next();
});
