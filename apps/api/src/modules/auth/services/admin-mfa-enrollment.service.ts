import { AuthenticationStorage, MfaService, PasswordHasher } from '@nestjs/authentication';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Prisma } from '#prisma/client';
import { ADMIN_SESSION_PURPOSE } from '#src/common/auth/admin-session-purpose.guard';
import {
  ADMIN_SESSION_ABSOLUTE_TTL_MS,
  ADMIN_SESSION_IDLE_TTL_MS,
  isAdminSessionExpired,
} from '#src/common/auth/admin-session-lifetime.policy';
import type { AppConfigService } from '#src/common/config/app-config.types';
import { createMfaEncryptionOptions } from '#src/common/config/mfa-keyring.config';
import { PrismaService } from '#src/infra/database/index';
import { toSessionRecord } from '../mappers/auth-session.mapper.js';
import { authSessionSelect } from '../selects/auth-session.select.js';
import { PrismaMfaStore } from '../stores/prisma-mfa.store.js';
import {
  AUTH_ACCOUNT_THROTTLE_POLICIES,
  AuthAccountThrottleService,
} from './auth-account-throttle.service.js';

const ENROLLMENT_TTL_MS = 5 * 60 * 1000;

type AdminPrincipal = { userId: string; sessionId: string };

async function readAdmin(db: Prisma.TransactionClient, principal: AdminPrincipal) {
  const row = await db.session.findUnique({
    where: { id: principal.sessionId, userId: principal.userId },
    select: {
      ...authSessionSelect,
      user: {
        select: { email: true, passwordHash: true, role: true, status: true, deletedAt: true },
      },
    },
  });
  if (
    !row ||
    row.user.role !== 'ADMIN' ||
    row.user.status !== 'ACTIVE' ||
    row.user.deletedAt !== null ||
    row.mfa !== null
  ) {
    throw new ForbiddenException('Administrative enrollment unavailable');
  }
  const session = toSessionRecord(row);
  if (
    session.metadata?.purpose !== ADMIN_SESSION_PURPOSE ||
    isAdminSessionExpired(session, Date.now())
  ) {
    throw new ForbiddenException('Administrative enrollment unavailable');
  }
  return { user: row.user, session };
}

/**
 * Internal first-enrollment staging only. The principal must come from the
 * server's validated Admin cookie, never a body or header supplied identity.
 * No controller may expose this before confirmation/recovery and login exist.
 */
@Injectable()
export class AdminMfaEnrollmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly store: PrismaMfaStore,
    private readonly passwords: PasswordHasher,
    private readonly throttle: AuthAccountThrottleService,
    @Inject(ConfigService) private readonly config: AppConfigService,
  ) {}

  async begin(principal: AdminPrincipal, password: string) {
    const keyring = this.config.get('MFA_ENCRYPTION_KEYS');
    if (!keyring) throw new ServiceUnavailableException('MFA enrollment unavailable');
    const encryption = createMfaEncryptionOptions(keyring, this.config.getOrThrow('JWT_SECRET'));

    const initial = await readAdmin(this.prisma, principal);
    await this.throttle.assertAllowed(
      principal.userId,
      AUTH_ACCOUNT_THROTTLE_POLICIES.adminMfaEnrollment,
    );
    // Avoid holding a database connection while computing the password hash.
    if (!(await this.passwords.verify(password, initial.user.passwordHash))) {
      throw new ForbiddenException('Administrative enrollment unavailable');
    }

    return this.store.withLockedOwner(principal.userId, async (tx, store) => {
      // Account row is already locked. Lock the exact persisted session so
      // a concurrent sign-out or revocation cannot pass the final check.
      await tx.$queryRaw`
        SELECT "id" FROM "sessions"
        WHERE "id" = ${principal.sessionId} AND "user_id" = ${principal.userId}
        FOR UPDATE
      `;
      const current = await readAdmin(tx, principal);
      if (current.user.passwordHash !== initial.user.passwordHash) {
        throw new ForbiddenException('Administrative enrollment unavailable');
      }

      const existing = await tx.mfaAuthenticator.findUnique({
        where: { userId: principal.userId },
      });
      const now = Date.now();
      if (
        existing?.confirmed ||
        existing?.pendingSecret ||
        (existing &&
          (!existing.enrollmentSessionId ||
            !existing.enrollmentExpiresAt ||
            existing.enrollmentExpiresAt.getTime() > now))
      ) {
        throw new ConflictException('MFA enrollment already exists');
      }
      // Only an expired, unconfirmed first enrollment may be replaced.
      const storage = new AuthenticationStorage();
      storage.registerSource({ mfa: store });
      const mfa = new MfaService(storage, { mfa: { encryption, issuer: 'OVRANTO' } });
      const enrollment = await mfa.enroll(principal.userId, current.user.email);
      const expiresAt = new Date(
        Math.min(
          now + ENROLLMENT_TTL_MS,
          current.session.expiresAt.getTime(),
          current.session.createdAt.getTime() + ADMIN_SESSION_ABSOLUTE_TTL_MS,
          current.session.lastActiveAt.getTime() + ADMIN_SESSION_IDLE_TTL_MS,
        ),
      );
      await tx.mfaAuthenticator.update({
        where: { userId: principal.userId },
        data: { enrollmentSessionId: principal.sessionId, enrollmentExpiresAt: expiresAt },
      });
      // A plaintext URI is returned only to this caller, never persisted or logged.
      return { ...enrollment, expiresAt };
    });
  }
}
