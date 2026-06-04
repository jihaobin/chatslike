import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import { userModelProviderSettingsAdapter } from '@/business/shared/adapters';
import type { CommercialRuntimeConfig } from '@/business/shared/commercialRuntime';
import { isSuperAdminRole } from '@/const/authRoles';
import { users } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';

import {
  GLOBAL_PROVIDER_CONFIG_USER_ID,
  ProviderConfigScope,
  type ProviderConfigScopeSelector,
} from './constants';

export const USER_PROVIDER_SETTINGS_DISABLED = 'USER_PROVIDER_SETTINGS_DISABLED';
export const GLOBAL_PROVIDER_SCOPE_FORBIDDEN = 'GLOBAL_PROVIDER_SCOPE_FORBIDDEN';

export const isUserProviderSettingsDisabled = (commercial?: CommercialRuntimeConfig) =>
  commercial ? !userModelProviderSettingsAdapter.canUseUserProviderSettings(commercial) : false;

export const assertUserProviderSettingsWritable = (commercial?: CommercialRuntimeConfig) => {
  if (!commercial || userModelProviderSettingsAdapter.canWriteModelProviderKeyVaults(commercial)) {
    return;
  }

  throw new TRPCError({ code: 'FORBIDDEN', message: USER_PROVIDER_SETTINGS_DISABLED });
};

export const getProviderConfigScopeUserId = (params: {
  requestedScope?: ProviderConfigScope;
  userId: string;
}) =>
  params.requestedScope === ProviderConfigScope.Global
    ? GLOBAL_PROVIDER_CONFIG_USER_ID
    : params.userId;

export const ensureGlobalProviderConfigUser = async (db: LobeChatDatabase) => {
  await db.insert(users).values({ id: GLOBAL_PROVIDER_CONFIG_USER_ID }).onConflictDoNothing();
};

export const assertGlobalProviderScopeReadable = async (params: {
  db: LobeChatDatabase;
  selector?: ProviderConfigScopeSelector;
  userId: string;
}) => {
  if (params.selector?.scope !== ProviderConfigScope.Global) return;

  const [user] = await params.db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, params.userId))
    .limit(1);

  if (!isSuperAdminRole(user?.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: GLOBAL_PROVIDER_SCOPE_FORBIDDEN });
  }
};

export const assertGlobalProviderScopeWritable = async (params: {
  db: LobeChatDatabase;
  selector?: ProviderConfigScopeSelector;
  userId: string;
}) => {
  await assertGlobalProviderScopeReadable(params);

  await ensureGlobalProviderConfigUser(params.db);
};
