import { AuthenticationRegistry } from '@nestjs/authentication';
import { Injectable, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ADMIN_COOKIE_ROUTE } from '#src/common/auth/admin-cookie-route';
import { AdminSessionCookieProvider } from '#src/common/auth/admin-session-cookie.provider';
import { ADMIN_SESSION_PURPOSE } from '#src/common/auth/admin-session-purpose.guard';
import { UsersRepository } from '#src/modules/users/repositories/users.repository';
import { AdminCookieAuthService } from '../services/admin-cookie-auth.service.js';

/**
 * Scoped provider: it is in the global auth registry but MUST return null
 * on non-Admin routes. Ordinary API access never reads __Host-admin-sid.
 */
@Injectable()
export class AdminSessionAuth extends AdminSessionCookieProvider {
  constructor(
    private readonly users: UsersRepository,
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
    const record = await this.cookies.sessions.validate(this.cookies.sessions.tokenFrom(request));
    if (record?.metadata?.purpose !== ADMIN_SESSION_PURPOSE) return null;

    const user = await this.users.findUserById(record.userId);
    if (!user) {
      await this.cookies.sessions.discard(record.id);
      return null;
    }
    return { user, session: record, mfa: record.mfa };
  }
}
