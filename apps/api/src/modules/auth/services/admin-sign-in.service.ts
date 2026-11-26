import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';

import type { SignInInput } from '../dto/auth.schemas.js';
import { CredentialsService } from './credentials.service.js';
import { AdminCookieAuthService } from './admin-cookie-auth.service.js';

/** Admin sign-in requires fresh password proof and the current ADMIN role.
 * The HTTP adapter must retain its AdminOriginGuard.
 */
@Injectable()
export class AdminSignInService {
  constructor(
    private readonly credentials: CredentialsService,
    private readonly cookies: AdminCookieAuthService,
  ) {}

  async signIn(
    body: SignInInput,
    request: Pick<Request, 'headers' | 'method'>,
    response: Response,
  ) {
    const user = await this.credentials.verify(body.email, body.password);
    if (!user || user.role !== 'ADMIN') {
      throw new UnauthorizedException('Invalid credentials');
    }
    const { session } = await this.cookies.signIn(user.id, request, response);
    return { mfaRequired: session.mfa === 'pending' };
  }
}
