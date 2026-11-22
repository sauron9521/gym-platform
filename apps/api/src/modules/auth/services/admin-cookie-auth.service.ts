import { createHash } from 'node:crypto';

import {
  AuthenticationEvents,
  AuthenticationStorage,
  MfaService,
  SessionService,
  type IssuedSession,
} from '@nestjs/authentication';
import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

import type { AppConfigService } from '#src/common/config/app-config.types';
import { ADMIN_SESSION_PURPOSE } from '#src/common/auth/admin-session-purpose.guard';

export const ADMIN_SESSION_COOKIE_NAME = '__Host-admin-sid';
type BrowserRequest = Pick<Request, 'headers' | 'method'>;

/**
 * Separate cookie realm; the account and session *storage* remain shared.
 * SessionService handles token crypto, expiry, same-site checks and rotation.
 * Never read or clear __Host-sid here.
 */
@Injectable()
export class AdminCookieAuthService {
  readonly sessions: SessionService;

  constructor(
    storage: AuthenticationStorage,
    private readonly mfa: MfaService,
    private readonly events: AuthenticationEvents,
    @Inject(ConfigService) config: AppConfigService,
  ) {
    const origin = new URL(config.get('ADMIN_APP_URL') ?? config.getOrThrow('APP_URL')).origin;
    this.sessions = new SessionService(
      storage,
      {
        session: {
          cookieName: ADMIN_SESSION_COOKIE_NAME,
          absoluteTtl: '8h',
          idleTtl: '15m',
          trustedOrigins: [origin],
        },
      },
      events,
    );
  }

  async signIn(
    userId: string,
    request: BrowserRequest,
    response: Response,
  ): Promise<IssuedSession> {
    if (this.sessions.isCrossOriginWrite(request)) {
      throw new ForbiddenException('Cross-origin sign-in refused');
    }
    const prior = this.sessions.tokenFrom(request);
    const priorSession = await this.sessions.validate(prior);
    const replacing = priorSession?.metadata?.purpose === ADMIN_SESSION_PURPOSE ? prior : undefined;
    const mfa = (await this.mfa.isEnrolled(userId)) ? 'pending' : undefined;
    const issued = await this.sessions.create(userId, {
      mfa,
      metadata: { purpose: ADMIN_SESSION_PURPOSE },
      replacing,
    });
    response.append('Set-Cookie', issued.cookie);
    this.events.emit({
      type: 'sign-in',
      userId,
      sessionId: issued.session.id,
      method: 'password',
      ...(mfa ? { mfa } : {}),
      metadata: issued.session.metadata,
    });
    return issued;
  }

  /**
   * Future step-up flow can rotate a pending Admin cookie without affecting
   * regular sessions; the server never treats pending MFA as authorized.
   */
  async completeMfa(
    request: BrowserRequest,
    response: Response,
    challenge: { code?: string; recoveryCode?: string },
  ): Promise<IssuedSession | null> {
    if (!challenge.code && !challenge.recoveryCode) return null;
    const record = await this.sessions.validate(this.sessions.tokenFrom(request));
    if (record?.metadata?.purpose !== ADMIN_SESSION_PURPOSE || record.mfa !== 'pending')
      return null;
    const verified = challenge.recoveryCode
      ? await this.mfa.verifyRecoveryCode(record.userId, challenge.recoveryCode)
      : await this.mfa.verifyTotp(record.userId, challenge.code!);
    if (!verified) return null;
    const rotated = await this.sessions.rotate(record, { mfa: 'verified' });
    if (rotated) response.append('Set-Cookie', rotated.cookie);
    return rotated;
  }

  /** Clear and revoke only the Admin cookie, including pending MFA. */
  async signOut(request: BrowserRequest, response: Response): Promise<boolean> {
    const token = this.sessions.tokenFrom(request);
    if (!token) return false;
    const record = await this.sessions.validate(token);
    response.append('Set-Cookie', this.sessions.clearCookie());
    if (record?.metadata?.purpose !== ADMIN_SESSION_PURPOSE) return false;
    // SessionService stores a SHA-256 base64url digest, never a raw token.
    await this.sessions.discard(createHash('sha256').update(token).digest('base64url'));
    this.events.emit({ type: 'sign-out', userId: record.userId, sessionId: record.id });
    return true;
  }
}
