import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Role } from '#prisma/client';
import { hasAdminPermission } from '#src/common/rbac/admin-permissions';
import { parseOperatorSuperAdminIds } from '#src/common/rbac/operator-superadmin-allowlist';

/**
 * Route-level permission gate runs AFTER @Authenticate().
 *
 * The global permission guard executes before controller authentication; placing
 * a RequireAdminPermissions decorator here would deny even valid operators.
 * Preserve the global guard's unrelated behavior and use the same permission
 * registry after the authenticated principal has been attached to the request.
 */
@Injectable()
export class AdminUsersReadGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<{
      user?: { id?: string; role?: Role };
    }>().user;

    const elevated = parseOperatorSuperAdminIds(this.config.get('SUPERADMIN_USER_IDS'));
    if (
      !user?.id ||
      !user.role ||
      !hasAdminPermission(user.role, 'admin.accounts.read', user.id, elevated)
    ) {
      throw new ForbiddenException('Insufficient administrative permissions');
    }
    return true;
  }
}
