import { createHash } from 'node:crypto';

import {
  AuthenticationEvents,
  AuthenticationStorage,
  MfaService,
  PasswordHasher,
  SessionService,
  type IssuedSession,
  type MfaStore,
} from '@nestjs/authentication';
import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Prisma } from '#prisma/client';
import { ADMIN_SESSION_PURPOSE } from '#src/common/auth/admin-session-purpose.guard';
import { isAdminSessionExpired } from '#src/common/auth/admin-session-lifetime.policy';
import type { AppConfigService } from '#src/common/config/app-config.types';
import { createMfaEncryptionOptions } from '#src/common/config/mfa-keyring.config';
import { PrismaService } from '#src/infra/database/index';
import { toSessionRecord } from '../mappers/auth-session.mapper.js';
import { authSessionSelect } from '../selects/auth-session.select.js';
import {
  ADMIN_MFA_PENDING_TTL_MS,
  AdminMfaTransactionSessionStore,
} from '../stores/admin-mfa-transaction-session.store.js';
import { PrismaMfaStore } from '../stores/prisma-mfa.store.js';
import {
  AUTH_ACCOUNT_THROTTLE_POLICIES,
  AuthAccountThrottleService,
} from './auth-account-throttle.service.js';

type ChallengeProof = { code?: string; recoveryCode?: string };

function readEnrolledAdmin(db: Prisma.TransactionClient, userId: string) {
  return db.user.findUnique({
    where: {
      id: userId,
      role: 'ADMIN',
      status: 'ACTIVE',
      deletedAt: null,
      mfaAuthenticator: { is: { confirmed: true } },
    },
    select: { passwordHash: true, authInvalidatedAt: true },
  });
}

function validProof({ code, recoveryCode }: ChallengeProof): boolean {
  return (
    (code === undefined &&
      typeof recoveryCode === 'string' &&
      /^[A-Za-z0-9]{5}-?[A-Za-z0-9]{5}$/.test(recoveryCode)) ||
    (recoveryCode === undefined && typeof code === 'string' && /^\d{6}$/.test(code))
  );
}

/**
 * Internal challenge only: no HTTP controller, no global session-store
 * exception, and no live MFA activation. A future caller must authenticate
 * the Admin origin, use the exact Admin cookie realm and prevent disclosure
 * of raw tokens. No client-supplied principal can complete a challenge.
 */
@Injectable()
export class AdminMfaChallengeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly factors: PrismaMfaStore,
    private readonly passwords: PasswordHasher,
    private readonly throttle: AuthAccountThrottleService,
    @Inject(ConfigService) private readonly config: AppConfigService,
  ) {}

  private encryption() {
    const keyring = this.config.get('MFA_ENCRYPTION_KEYS');
    if (!keyring) throw new ServiceUnavailableException('Administrative MFA unavailable');
    return createMfaEncryptionOptions(keyring, this.config.getOrThrow('JWT_SECRET'));
  }

  private sessions(
    tx: Prisma.TransactionClient,
    userId: string,
    state: 'pending' | 'verified',
    mfaStore: MfaStore,
  ) {
    const storage = new AuthenticationStorage();
    storage.registerSource({
      mfa: mfaStore,
      sessions: new AdminMfaTransactionSessionStore(tx, userId, state),
    });
    const appUrl = this.config.get('ADMIN_APP_URL') ?? this.config.getOrThrow('APP_URL');
    const origin = new URL(appUrl).origin;
    return {
      storage,
      sessions: new SessionService(
        storage,
        {
          mfa: { pendingTtl: '5m' },
          session: {
            cookieName: '__Host-admin-sid',
            absoluteTtl: '8h',
            idleTtl: '15m',
            trustedOrigins: [origin],
          },
        },
        new AuthenticationEvents(),
      ),
    };
  }

  async begin(userId: string, password: string): Promise<IssuedSession | null> {
    this.encryption();
    const initial = await readEnrolledAdmin(this.prisma, userId);
    if (!initial) return null;
    await this.throttle.assertAllowed(userId, AUTH_ACCOUNT_THROTTLE_POLICIES.adminMfaSignIn);
    if (!(await this.passwords.verify(password, initial.passwordHash))) return null;

    return this.factors.withLockedOwner(userId, async (tx, store) => {
      const current = await readEnrolledAdmin(tx, userId);
      if (
        !current ||
        current.passwordHash !== initial.passwordHash ||
        current.authInvalidatedAt?.getTime() !== initial.authInvalidatedAt?.getTime()
      ) {
        return null;
      }
      const { sessions } = this.sessions(tx, userId, 'pending', store);
      return sessions.create(userId, {
        mfa: 'pending',
        metadata: { purpose: ADMIN_SESSION_PURPOSE },
      });
    });
  }

  async complete(token: string, proof: ChallengeProof): Promise<IssuedSession | null> {
    const encryption = this.encryption();
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token) || !validProof(proof)) {
      return null;
    }
    // Match the existing library's SHA-256 base64url session ID contract.
    const id = createHash('sha256').update(token).digest('base64url');
    // Use an independent filtered read rather than findUnique's automatic
    // batching: simultaneous challenges must resolve their own exact cookie.
    const initial = await this.prisma.session.findFirst({
      where: { id, mfa: 'pending', metadata: { path: ['purpose'], equals: ADMIN_SESSION_PURPOSE } },
      select: { userId: true },
    });
    if (!initial) return null;
    const { userId } = initial;
    await this.throttle.assertAllowed(userId, AUTH_ACCOUNT_THROTTLE_POLICIES.adminMfaChallenge);

    return this.factors.withLockedOwner(userId, async (tx, store) => {
      // Owner first, then exact session: logout cannot race proof/rotation.
      await tx.$queryRaw`
        SELECT "id" FROM "sessions"
        WHERE "id" = ${id} AND "user_id" = ${userId}
        FOR UPDATE
      `;
      const user = await readEnrolledAdmin(tx, userId);
      const row = await tx.session.findFirst({
        where: { id, userId, mfa: 'pending' },
        select: authSessionSelect,
      });
      if (!user || !row) return null;
      const record = toSessionRecord(row);
      const pendingDeadline = record.createdAt.getTime() + ADMIN_MFA_PENDING_TTL_MS;
      if (
        record.metadata?.purpose !== ADMIN_SESSION_PURPOSE ||
        isAdminSessionExpired(record, Date.now()) ||
        Date.now() >= pendingDeadline ||
        (user.authInvalidatedAt && record.createdAt <= user.authInvalidatedAt)
      ) {
        return null;
      }

      const { storage, sessions } = this.sessions(tx, userId, 'verified', store);
      const mfa = new MfaService(storage, { mfa: { encryption, issuer: 'OVRANTO' } });
      const verified =
        proof.recoveryCode !== undefined
          ? await mfa.verifyRecoveryCode(userId, proof.recoveryCode)
          : await mfa.verifyTotp(userId, proof.code!);
      // Commit durable failure accounting rather than rolling it back.
      if (!verified) return null;
      if (Date.now() >= pendingDeadline || isAdminSessionExpired(record, Date.now())) {
        throw new Error('Administrative MFA challenge expired during verification');
      }

      const rotated = await sessions.rotate(record, { mfa: 'verified' });
      if (
        !rotated ||
        rotated.session.createdAt.getTime() !== record.createdAt.getTime() ||
        rotated.session.id === id
      ) {
        throw new Error('Administrative MFA session rotation failed');
      }
      await tx.mfaLifecycleAudit.create({
        data: {
          userId,
          action:
            proof.recoveryCode !== undefined
              ? 'ADMIN_RECOVERY_CHALLENGE_VERIFIED'
              : 'ADMIN_TOTP_CHALLENGE_VERIFIED',
        },
      });
      // Recovery consumption, replay claim, rotation and audit commit together.
      return rotated;
    });
  }
}
