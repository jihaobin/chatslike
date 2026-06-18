export const SUPER_ADMIN_ROLE = 'super-admin';
export const ADMIN_ROLE = 'admin';

export const isSuperAdminRole = (role?: string | null) => role === SUPER_ADMIN_ROLE;

export const isAdminRole = (role?: string | null) => role === ADMIN_ROLE;

export const isAdminOrSuperAdminRole = (role?: string | null) =>
  isAdminRole(role) || isSuperAdminRole(role);
