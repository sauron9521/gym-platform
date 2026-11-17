import type { Role } from '#prisma/client';

/**
 * Server-side permission registry for future Admin controllers.
 * Explicit deny by default; adding an enum value must not silently grant access.
 */
export const ADMIN_PERMISSIONS = [
  'admin.console.read',
  'admin.metrics.read',
  'admin.exercises.manage',
  'admin.categories.manage',
  'admin.accounts.manage',
  'admin.roles.assign',
  'admin.audit.read',
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

const ADMIN_ALLOWED: ReadonlySet<AdminPermission> = new Set(['admin.console.read']);

/**
 * The present ADMIN role can read the administrative shell only.
 * Future elevated roles and granular grants require an explicit Prisma
 * migration, authorization design, and separately audited endpoints.
 */
export function hasAdminPermission(role: Role, permission: AdminPermission): boolean {
  return role === 'ADMIN' && ADMIN_ALLOWED.has(permission);
}
