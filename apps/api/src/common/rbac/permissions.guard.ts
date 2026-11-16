import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { Role } from '#prisma/client';
import { hasAdminPermission } from './admin-permissions.js';
import type { AdminPermission } from './admin-permissions.js';
import { REQUIRED_ADMIN_PERMISSIONS } from './permissions.decorator.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

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
      (controller !== undefined && !Array.isArray(controller)) ||
      (handler !== undefined && !Array.isArray(handler)) ||
      (controller?.length ?? 0) + (handler?.length ?? 0) === 0
    ) {
      throw new ForbiddenException('Invalid administrative permission requirement');
    }

    const required = [...(controller ?? []), ...(handler ?? [])];
    const role = context.switchToHttp().getRequest<{ user?: { role?: Role } }>().user?.role;
    if (!role || !required.every((permission) => hasAdminPermission(role, permission))) {
      throw new ForbiddenException('Insufficient administrative permissions');
    }

    return true;
  }
}
