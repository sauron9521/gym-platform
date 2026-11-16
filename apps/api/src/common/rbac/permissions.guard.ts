import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { Role } from '#prisma/client';
import { hasAdminPermission } from './admin-permissions.js';
import { REQUIRED_ADMIN_PERMISSIONS } from './permissions.decorator.js';
import type { AdminPermission } from './admin-permissions.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<AdminPermission[]>(
      REQUIRED_ADMIN_PERMISSIONS,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;

    const actor = context.switchToHttp().getRequest<{ user?: { role?: Role } }>().user;
    if (!actor?.role || !required.every((permission) => hasAdminPermission(actor.role!, permission))) {
      throw new ForbiddenException('Insufficient administrative permissions');
    }
    return true;
  }
}
