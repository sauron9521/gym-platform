import { createHash } from 'node:crypto';

import { AuthenticationStorage, MfaService, PasswordHasher } from '@nestjs/authentication';
import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Prisma } from '#prisma/client';
import { isAdminSessionExpired } from '#src/common/auth/admin-session-lifetime.policy';
import type { AppConfigService } from '#src/common/config/app-config.types';
import { createMfaEncryptionOptions } from '#src/common/config/mfa-keyring.config';
import { PrismaService } from '#src/infra/database/index';
import { toSessionRecord } from '../mappers/auth-session.mapper.js';
import { authSessionSelect } from '../selects/auth-session.select.js';
import { adminMfaSessionScope } from '../stores/admin-mfa-session-scope.js';
import { PrismaMfaStore } from '../stores/prisma-mfa.store.js';
import {
  AUTH_ACCOUNT_THROTTLE_POLICIES,
  AuthAccountThrottleService,
} from './auth-account-throttle.service.js';

async function readVerifiedAdmin(db: Prisma.TransactionClient, id: string) {
  const row = await db.session.findFirst({
    where: {
      ...adminMfaSessionScope(id),
      mfa: 'verified',
      user: {
        role: 'ADMIN',
        status: 'ACTIVE',
        deletedAt: null,
        mfaAuthenticator: { is: { confirmed: true, pendingSecret: null } },
      },
    },
    select: {
      ...authSessionSelect,
      user: { select: { passwordHash: true, authInvalidatedAt: true } },
    },
  });
  if (!row) return null;
  const record = toSessionRecord(row);
  const fence = row.user.authInvalidatedAt;
  if (isAdminSessionExpired(record, Date.now()) || (fence && record.createdAt <= fence)) {
    return null;
  }
  return row;
}

/**
 * Internal self-service recovery-code replacement, NOT lost-factor recovery.
 * A future HTTP caller must extract the exact Admin cookie, validate origin,
 * send no-store responses and never log the raw proof or returned codes.
 */
@Injectable()
export class AdminMfaRecoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly factors: PrismaMfaStore,
    private readonly passwords: PasswordHasher,
    private readonly throttle: AuthAccountThrottleService,
    @Inject(ConfigService) private readonly config: AppConfigService,
  ) {}

  async regenerate(
    token: string,
    password: string,
    code: string,
  ): Promise<{ recoveryCodes: string[] } | null> {
    const keyring = this.config.get('MFA_ENCRYPTION_KEYS');
    if (!keyring) throw new ServiceUnavailableException('Administrative recovery unavailable');
    const encryption = createMfaEncryptionOptions(keyring, this.config.getOrThrow('JWT_SECRET'));
    if (!/^[A-Za-z0-9_-]{43}$/.test(token) || !/^\d{6}$/.test(code)) return null;

    const id = createHash('sha256').update(token).digest('base64url');
    const initial = await readVerifiedAdmin(this.prisma, id);
    if (!initial) return null;
    const userId = initial.userId;
    await this.throttle.assertAllowed(
      userId,
      AUTH_ACCOUNT_THROTTLE_POLICIES.adminMfaRecoveryRegenerate,
    );
    const proofStartedAt = Date.now();
    if (!(await this.passwords.verify(password, initial.user.passwordHash))) return null;

    return this.factors.withLockedOwner(userId, async (tx, store) => {
      await tx.$queryRaw`
        SELECT "id" FROM "sessions"
        WHERE "id" = ${id} AND "user_id" = ${userId}
        FOR UPDATE
      `;
      const current = await readVerifiedAdmin(tx, id);
      if (
        !current ||
        current.userId !== userId ||
        current.user.passwordHash !== initial.user.passwordHash ||
        current.user.authInvalidatedAt?.getTime() !== initial.user.authInvalidatedAt?.getTime() ||
        Date.now() - proofStartedAt >= 300_000
      ) {
        return null;
      }
      const storage = new AuthenticationStorage();
      storage.registerSource({ mfa: store });
      const mfa = new MfaService(storage, { mfa: { encryption, issuer: 'OVRANTO' } });
      // Fresh TOTP only, never a recovery code or the existing session alone.
      if (!(await mfa.verifyTotp(userId, code))) return null;
      const recoveryCodes = await mfa.generateRecoveryCodes(userId);
      const fence = new Date();
      if (
        isAdminSessionExpired(toSessionRecord(current), fence.getTime()) ||
        fence.getTime() - proofStartedAt >= 300_000
      ) {
        throw new Error('Administrative recovery proof expired during replacement');
      }

      // All writes commit together; the caller receives the new plaintext
      // batch only after commit. Re-authentication is required on all devices.
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
      await tx.mfaLifecycleAudit.create({
        data: { userId, action: 'ADMIN_RECOVERY_CODES_REGENERATED' },
      });
      return { recoveryCodes };
    });
  }
}
