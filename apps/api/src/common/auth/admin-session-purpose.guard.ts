import type { SessionRecord } from '@nestjs/authentication';
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

export const ADMIN_SESSION_PURPOSE = 'admin' as const;

/**
 * Enforce an explicit, server-issued admin browser session after authentication.
 * The cookie-only authentication provider must run BEFORE this route-level guard.
 * Ordinary cookies, bearer JWTs, mismatched principals and pending or malformed MFA states cannot pass.
 * Undefined MFA remains a transitional legacy state until enrollment is available.
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
      request.session?.metadata?.purpose !== ADMIN_SESSION_PURPOSE ||
      request.session.userId !== request.user.id ||
      (request.session.mfa !== undefined && request.session.mfa !== 'verified')
    ) {
      throw new ForbiddenException('Administrative session required');
    }
    return true;
  }
}
