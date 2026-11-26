import { Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';

import { PrismaSessionStore } from '../stores/prisma-session.store.js';
import { AdminCookieAuthService } from './admin-cookie-auth.service.js';

/** Narrow Admin session commands. The caller must authenticate and authorize
 * the principal for revokeAll; signOut also supports pending-MFA cookies.
 * Store registration, cookie mechanics and MFA internals remain private.
 */
@Injectable()
export class AdminSessionFacade {
  constructor(
    private readonly store: PrismaSessionStore,
    private readonly cookies: AdminCookieAuthService,
  ) {}

  async revokeAll(
    userId: string,
    request: Pick<Request, 'headers' | 'method'>,
    response: Response,
  ): Promise<void> {
    await this.store.revokeAdminSessionsForUser(userId);
    // Even when the server session is gone, signOut clears this browser's
    // Admin cookie. Preserve the original success semantics for false.
    await this.cookies.signOut(request, response);
  }

  signOut(request: Pick<Request, 'headers' | 'method'>, response: Response): Promise<boolean> {
    return this.cookies.signOut(request, response);
  }
}
