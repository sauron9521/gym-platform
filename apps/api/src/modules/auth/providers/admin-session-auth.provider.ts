import { AuthenticationRegistry } from '@nestjs/authentication';
import { Injectable, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ADMIN_COOKIE_ROUTE } from '#src/common/auth/admin-cookie-route';
import { AdminSessionCookieProvider } from '#src/common/auth/admin-session-cookie.provider';
import { ADMIN_SESSION_PURPOSE } from '#src/common/auth/admin-session-purpose.guard';
import { UsersAuthFacade } from '#src/modules/users/services/users-auth.facade';
import { AdminCookieAuthService } from '../services/admin-cookie-auth.service.js';

/**
 * Scoped provider: it is in the global auth registry but MUST return null
 * on non-Admin routes. Ordinary API access never reads __Host-admin-sid.
 */
@Injectable()
export class AdminSessionAuth extends AdminSessionCookieProvider {
  constructor(
    private readonly users: UsersAuthFacade,
    private readonly cookies: AdminCookieAuthService,
    private readonly reflector: Reflector,
    registry: AuthenticationRegistry,
  ) {
    super();
    registry.registerProvider(this, { order: 2 });
  }

  async authenticate(context: ExecutionContext) {
    const explicit = this.reflector.getAllAndOverride<boolean>(ADMIN_COOKIE_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!explicit || context.getType() !== 'http') return null;

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      method?: string;
    }>();
    const record = await this.cookies.validateAdminSession({
      headers: request.headers,
      method: request.method ?? 'GET',
    });
    if (record?.metadata?.purpose !== ADMIN_SESSION_PURPOSE) return null;
    // The persisted string is not a trusted enum at runtime. The package
    // rejects pending MFA, but an unknown value must not become ordinary auth.
    if (record.mfa !== undefined && record.mfa !== 'verified') {
      return null;
    }

    const user = await this.users.findUserById(record.userId);
    if (!user) {
      await this.cookies.sessions.discard(record.id);
      return null;
    }
    // Preserve the legacy authentication/authorization split: the route
    // guard returns 403 for a demoted password-only principal. A scoped MFA
    // session additionally requires the current Admin role at this boundary.
    if (record.mfa === 'verified' && user.role !== 'ADMIN') return null;
    return { user, session: record, mfa: record.mfa };
  }
}
