import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';

import type { AppConfigService } from '#src/common/config/app-config.types';

import type { Role } from '#prisma/client';
import { hasAdminPermission } from './admin-permissions.js';
import type { AdminPermission } from './admin-permissions.js';
import { REQUIRED_ADMIN_PERMISSIONS } from './permissions.decorator.js';
import { parseOperatorSuperAdminIds } from './operator-superadmin-allowlist.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Optional() @Inject(ConfigService) private readonly config?: AppConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // Class and method requirements are cumulative: a method may never weaken
    // permissions declared at the controller level.
    const controller = this.reflector.get<AdminPermission[]>(
      REQUIRED_ADMIN_PERMISSIONS,
      context.getClass(),
    );
    const handler = this.reflector.get<AdminPermission[]>(
      REQUIRED_ADMIN_PERMISSIONS,
      context.getHandler(),
    );

    // Unannotated existing routes retain their current authentication policy.
    if (controller === undefined && handler === undefined) return true;

    // A malformed or empty annotation must never turn a protected route public.
    if (
      (controller !== undefined && (!Array.isArray(controller) || controller.length === 0)) ||
      (handler !== undefined && (!Array.isArray(handler) || handler.length === 0))
    ) {
      throw new ForbiddenException('Invalid administrative permission requirement');
    }

    const required = [...(controller ?? []), ...(handler ?? [])];
    const principal = context.switchToHttp().getRequest<{
      user?: { id?: string; role?: Role };
    }>().user;

    // Parsing a malformed or unavailable configuration never grants privileges.
    const elevatedIds = parseOperatorSuperAdminIds(this.config?.get('SUPERADMIN_USER_IDS'));
    if (
      !principal?.role ||
      !required.every((permission) =>
        hasAdminPermission(principal.role!, permission, principal.id, elevatedIds),
      )
    ) {
      throw new ForbiddenException('Insufficient administrative permissions');
    }

    return true;
  }
}
