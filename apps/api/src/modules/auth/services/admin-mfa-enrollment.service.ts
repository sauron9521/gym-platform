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

async function lockAdminSession(tx: Prisma.TransactionClient, principal: AdminPrincipal) {
  await tx.$queryRaw`
    SELECT "id" FROM "sessions"
    WHERE "id" = ${principal.sessionId} AND "user_id" = ${principal.userId}
    FOR UPDATE
  `;
  return readAdmin(tx, principal);
}

/**
 * Internal first-enrollment staging and confirmation. The principal must come from the
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

  private encryption() {
    const keyring = this.config.get('MFA_ENCRYPTION_KEYS');
    if (!keyring) throw new ServiceUnavailableException('MFA enrollment unavailable');
    return createMfaEncryptionOptions(keyring, this.config.getOrThrow('JWT_SECRET'));
  }

  async begin(principal: AdminPrincipal, password: string) {
    const encryption = this.encryption();
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
      const current = await lockAdminSession(tx, principal);
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

  /**
   * No HTTP route: activation must stay gated until every sign-in path
   * enforces enrolled factors. Failed proof returns null INSIDE the transaction
   * so the library's durable attempt counter is committed, not rolled back.
   */
  async confirm(
    principal: AdminPrincipal,
    code: string,
  ): Promise<{ recoveryCodes: string[] } | null> {
    const encryption = this.encryption();
    await readAdmin(this.prisma, principal);
    await this.throttle.assertAllowed(
      principal.userId,
      AUTH_ACCOUNT_THROTTLE_POLICIES.adminMfaConfirmation,
    );
    if (typeof code !== 'string' || !/^\d{6}$/.test(code)) return null;

    return this.store.withLockedOwner(principal.userId, async (tx, store) => {
      await lockAdminSession(tx, principal);
      const pending = await tx.mfaAuthenticator.findUnique({ where: { userId: principal.userId } });
      if (
        !pending ||
        pending.confirmed ||
        pending.pendingSecret !== null ||
        pending.enrollmentSessionId !== principal.sessionId ||
        !pending.enrollmentExpiresAt ||
        pending.enrollmentExpiresAt.getTime() <= Date.now()
      ) {
        throw new ForbiddenException('Administrative enrollment unavailable');
      }

      const storage = new AuthenticationStorage();
      storage.registerSource({ mfa: store });
      const mfa = new MfaService(storage, { mfa: { encryption, issuer: 'OVRANTO' } });
      if (!(await mfa.confirm(principal.userId, code))) return null;
      const recoveryCodes = await mfa.generateRecoveryCodes(principal.userId);

      // Recheck expiry after the recovery-code hashing work. Any exception
      // rolls back activation, replay claim, codes, audit and revocation.
      await readAdmin(tx, principal);
      const fence = new Date();
      if (pending.enrollmentExpiresAt <= fence) {
        throw new ForbiddenException('Administrative enrollment unavailable');
      }

      await tx.mfaAuthenticator.update({
        where: { userId: principal.userId },
        data: { enrollmentSessionId: null, enrollmentExpiresAt: null },
      });
      // Factors belong to the shared identity. Revoke ALL prior credentials,
      // including the enrollment session; do not upgrade an old cookie in place.
      await tx.user.update({ where: { id: principal.userId }, data: { authInvalidatedAt: fence } });
      await tx.session.deleteMany({ where: { userId: principal.userId } });
      await tx.refreshTokenFamily.updateMany({
        where: { userId: principal.userId, revokedAt: null },
        data: { revokedAt: fence },
      });
      await tx.refreshToken.updateMany({
        where: { userId: principal.userId, revoked: false },
        data: { revoked: true },
      });
      await tx.mfaLifecycleAudit.create({
        data: { userId: principal.userId, action: 'FIRST_TOTP_CONFIRMED' },
      });
      return { recoveryCodes };
    });
  }
}
