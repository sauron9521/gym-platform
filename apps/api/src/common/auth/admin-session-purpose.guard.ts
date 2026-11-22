import type { SessionRecord } from '@nestjs/authentication';
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

export const ADMIN_SESSION_PURPOSE = 'admin' as const;

/**
 * Enforce an explicit, server-issued admin browser session after authentication.
 * The cookie-only authentication provider must run BEFORE this route-level guard.
 * Ordinary /auth/login cookies, bearer JWTs and revoked ADMIN roles cannot pass.
 */
@Injectable()
export class AdminSessionPurposeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      user?: { id?: string; role?: string } | null;
      session?: SessionRecord | null;
    }>();
    if (
      !request.user?.id ||
      request.user.role !== 'ADMIN' ||
      request.session?.metadata?.purpose !== ADMIN_SESSION_PURPOSE
    ) {
      throw new ForbiddenException('Administrative session required');
    }
    return true;
  }
}
