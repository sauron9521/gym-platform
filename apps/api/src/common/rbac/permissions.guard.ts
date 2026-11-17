import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';

import type { Role } from '#prisma/client';
import { hasAdminPermission } from './admin-permissions.js';
import type { AdminPermission } from './admin-permissions.js';
import { REQUIRED_ADMIN_PERMISSIONS } from './permissions.decorator.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Optional() private readonly config?: ConfigService,
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
    const principal = context
      .switchToHttp()
      .getRequest<{ user?: { id?: string; role?: Role } }>().user;
    // The user ID must come from the verified NestJS authentication provider.
    const superAdminIds = new Set(
      (this.config?.get<string>('SUPERADMIN_USER_IDS') ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    );
    if (
      !principal?.role ||
      !required.every((permission) =>
        hasAdminPermission(principal.role!, permission, principal.id, superAdminIds),
      )
    ) {
      throw new ForbiddenException('Insufficient administrative permissions');
    }

    return true;
  }
}
