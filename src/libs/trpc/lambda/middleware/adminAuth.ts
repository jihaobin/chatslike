import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import { isAdminOrSuperAdminRole } from '@/const/authRoles';
import { RbacModel } from '@/database/models/rbac';
import { users } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';

import { trpc } from '../init';

/**
 * Allows through if the user has users.role = 'super-admin'/'admin' (legacy)
 * OR has the admin:dashboard_read:all RBAC permission (new system).
 * Must be used after the serverDatabase middleware (which injects ctx.serverDB).
 */
export const adminAuth = trpc.middleware(async ({ ctx, next }) => {
  const { serverDB, userId } = ctx as typeof ctx & { serverDB: LobeChatDatabase; userId: string };

  const [userRow] = await serverDB
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId));

  if (isAdminOrSuperAdminRole(userRow?.role)) return next();

  const rbac = new RbacModel(serverDB, userId);
  const hasAccess = await rbac.hasPermission('admin:dashboard_read:all');
  if (!hasAccess) throw new TRPCError({ code: 'FORBIDDEN' });

  return next();
});
