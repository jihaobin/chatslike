import { eq } from 'drizzle-orm';

import { isAdminOrSuperAdminRole, isSuperAdminRole } from '@/const/authRoles';
import { RbacModel } from '@/database/models/rbac';
import { users } from '@/database/schemas';
import { adminProcedure, authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware/serverDatabase';

import { auditRouter } from './audit';
import { dashboardRouter } from './dashboard';
import { ordersRouter } from './orders';
import { usageRouter } from './usage';
import { usersRouter } from './users';

export const adminRouter = router({
  // Called by AdminGuard — must NOT require admin permission itself
  checkAccess: authedProcedure.use(serverDatabase).query(async ({ ctx }) => {
    const [userRow] = await ctx.serverDB
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, ctx.userId));

    // Legacy: users.role field
    if (isAdminOrSuperAdminRole(userRow?.role)) {
      return { hasAccess: true, isSuperAdmin: isSuperAdminRole(userRow?.role) };
    }

    // New: RBAC permissions
    const rbac = new RbacModel(ctx.serverDB, ctx.userId);
    const [hasAccess, isSuperAdmin] = await Promise.all([
      rbac.hasPermission('admin:dashboard_read:all'),
      rbac.hasPermission('admin:audit_read:all'),
    ]);
    return { hasAccess, isSuperAdmin };
  }),

  ping: adminProcedure.query(() => 'pong'),

  audit: auditRouter,
  dashboard: dashboardRouter,
  orders: ordersRouter,
  usage: usageRouter,
  users: usersRouter,
});
