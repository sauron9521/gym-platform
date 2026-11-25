import { createHash } from 'node:crypto';

import {
  AuthenticationStorage,
  MfaService,
  PasswordHasher,
  type MfaStore,
} from '@nestjs/authentication';
import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Prisma } from '#prisma/client';
import { isAdminSessionExpired } from '#src/common/auth/admin-session-lifetime.policy';
import type { AppConfigService } from '#src/common/config/app-config.types';
import { createMfaEncryptionOptions } from '#src/common/config/mfa-keyring.config';
import { PrismaService } from '#src/infra/database/index';
import { toSessionRecord } from '../mappers/auth-session.mapper.js';
import { recordMfaSecurityEvent } from './record-mfa-security-event.js';
import { authSessionSelect } from '../selects/auth-session.select.js';
import {
  ADMIN_RECOVERY_TTL_MS,
  adminMfaSessionScope,
  isCurrentRecoveryGrant,
} from '../stores/admin-mfa-session-scope.js';
import { PrismaMfaStore } from '../stores/prisma-mfa.store.js';
import {
  AUTH_ACCOUNT_THROTTLE_POLICIES,
  AuthAccountThrottleService,
  type AuthAccountThrottlePolicy,
} from './auth-account-throttle.service.js';

const REPLACEMENT_TTL_MS = 5 * 60 * 1000;

async function readGrant(db: Prisma.TransactionClient, id: string) {
  const row = await db.session.findFirst({
    where: {
      ...adminMfaSessionScope(id),
      mfa: 'verified',
      user: {
        role: 'ADMIN',
        status: 'ACTIVE',
        deletedAt: null,
        mfaAuthenticator: { is: { confirmed: true } },
      },
    },
    select: {
      ...authSessionSelect,
      user: { select: { email: true, passwordHash: true, authInvalidatedAt: true } },
    },
  });
  if (!row) return null;
  const record = toSessionRecord(row);
  const now = Date.now();
  if (
    isAdminSessionExpired(record, now) ||
    !isCurrentRecoveryGrant(record, row.user.authInvalidatedAt, now)
  ) {
    return null;
  }
  return row;
}

type Grant = NonNullable<Awaited<ReturnType<typeof readGrant>>>;

function createMfa(store: MfaStore, encryption: ReturnType<typeof createMfaEncryptionOptions>) {
  const storage = new AuthenticationStorage();
  storage.registerSource({ mfa: store });
  return new MfaService(storage, { mfa: { encryption, issuer: 'OVRANTO' } });
}

/**
 * Internal lost-device replacement. Restricted recovery grants cannot
 * authorize any ordinary Admin operation. A future HTTP caller must
 * validate the Admin origin, use the exact cookie and return no-store
 * responses without logging the proof, URI, secret or recovery codes.
 */
@Injectable()
export class AdminMfaReplacementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly factors: PrismaMfaStore,
    private readonly passwords: PasswordHasher,
    private readonly throttle: AuthAccountThrottleService,
    @Inject(ConfigService) private readonly config: AppConfigService,
  ) {}

  private encryption() {
    const keyring = this.config.get('MFA_ENCRYPTION_KEYS');
    if (!keyring) throw new ServiceUnavailableException('Administrative replacement unavailable');
    return createMfaEncryptionOptions(keyring, this.config.getOrThrow('JWT_SECRET'));
  }

  private async withGrant<T>(
    token: string,
    password: string,
    policy: AuthAccountThrottlePolicy,
    work: (tx: Prisma.TransactionClient, store: MfaStore, grant: Grant) => Promise<T | null>,
  ): Promise<T | null> {
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    if (typeof password !== 'string') return null;
    const id = createHash('sha256').update(token).digest('base64url');
    const initial = await readGrant(this.prisma, id);
    if (!initial) return null;
    const userId = initial.userId;
    await this.throttle.assertAllowed(userId, policy);
    const started = Date.now();
    if (!(await this.passwords.verify(password, initial.user.passwordHash))) return null;
    return this.factors.withLockedOwner(userId, async (tx, store) => {
      await tx.$queryRaw`
        SELECT "id" FROM "sessions"
        WHERE "id" = ${id} AND "user_id" = ${userId}
        FOR UPDATE
      `;
      const current = await readGrant(tx, id);
      if (
        !current ||
        current.userId !== userId ||
        current.user.passwordHash !== initial.user.passwordHash ||
        current.user.authInvalidatedAt?.getTime() !== initial.user.authInvalidatedAt?.getTime() ||
        Date.now() - started >= REPLACEMENT_TTL_MS
      ) {
        return null;
      }
      return work(tx, store, current);
    });
  }

  async begin(token: string, password: string) {
    const encryption = this.encryption();
    const policy = AUTH_ACCOUNT_THROTTLE_POLICIES.adminMfaReplacementBegin;
    return this.withGrant(token, password, policy, async (tx, store, grant) => {
      const { userId, id } = grant;
      const factor = await tx.mfaAuthenticator.findUnique({ where: { userId } });
      if (!factor?.confirmed) return null;
      // A live bound replacement cannot be silently overwritten. An expired
      // candidate or one belonging to a revoked grant may be replaced.
      const boundUntil = factor.enrollmentExpiresAt?.getTime();
      if (factor.pendingSecret && boundUntil && boundUntil > Date.now()) {
        if (!factor.enrollmentSessionId) return null;
        const bound = await readGrant(tx, factor.enrollmentSessionId);
        if (bound) return null;
      }
      if (factor.pendingSecret && (!factor.enrollmentSessionId || !factor.enrollmentExpiresAt)) {
        return null;
      }
      const mfa = createMfa(store, encryption);
      const enrollment = await mfa.enroll(userId, grant.user.email, { replace: true });
      const expiresAt = new Date(
        Math.min(
          Date.now() + REPLACEMENT_TTL_MS,
          grant.expiresAt.getTime(),
          grant.createdAt.getTime() + ADMIN_RECOVERY_TTL_MS,
        ),
      );
      if (expiresAt.getTime() <= Date.now()) {
        throw new Error('Administrative replacement grant expired');
      }
      await tx.mfaAuthenticator.update({
        where: { userId },
        data: { enrollmentSessionId: id, enrollmentExpiresAt: expiresAt },
      });
      await recordMfaSecurityEvent(tx, userId, 'ADMIN_TOTP_REPLACEMENT_STAGED');
      return { ...enrollment, expiresAt };
    });
  }

  async confirm(
    token: string,
    password: string,
    code: string,
  ): Promise<{ recoveryCodes: string[] } | null> {
    const encryption = this.encryption();
    if (typeof code !== 'string' || !/^\d{6}$/.test(code)) return null;
    const policy = AUTH_ACCOUNT_THROTTLE_POLICIES.adminMfaReplacementConfirm;
    return this.withGrant(token, password, policy, async (tx, store, grant) => {
      const { userId, id } = grant;
      const factor = await tx.mfaAuthenticator.findUnique({ where: { userId } });
      if (
        !factor?.confirmed ||
        !factor.pendingSecret ||
        factor.enrollmentSessionId !== id ||
        !factor.enrollmentExpiresAt ||
        factor.enrollmentExpiresAt.getTime() <= Date.now()
      ) {
        return null;
      }
      const mfa = createMfa(store, encryption);
      // The library checks the new candidate, not the currently active factor.
      // A failed proof must commit its attempt counter.
      if (!(await mfa.confirm(userId, code))) return null;
      const recoveryCodes = await mfa.generateRecoveryCodes(userId);
      const fence = new Date();
      if (factor.enrollmentExpiresAt <= fence || !(await readGrant(tx, id))) {
        throw new Error('Administrative replacement grant expired during confirmation');
      }

      await tx.mfaAuthenticator.update({
        where: { userId },
        data: { enrollmentSessionId: null, enrollmentExpiresAt: null },
      });
      await tx.user.update({ where: { id: userId }, data: { authInvalidatedAt: fence } });
      await tx.session.deleteMany({ where: { userId } });
      await tx.refreshTokenFamily.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: fence },
      });
      await tx.refreshToken.updateMany({
        where: { userId, revoked: false },
        data: { revoked: true },
      });
      await recordMfaSecurityEvent(tx, userId, 'ADMIN_TOTP_REPLACEMENT_CONFIRMED');
      return { recoveryCodes };
    });
  }
}
