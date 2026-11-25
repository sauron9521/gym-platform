import { AuthenticationStorage, type MfaStore, type TotpRecord } from '@nestjs/authentication';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '#src/infra/database/index';
import { lockActiveCredentialOwner } from './lock-active-credential-owner.js';

/**
 * Durable storage for the library's opaque sealed secrets and recovery hashes.
 * No encryption keys, plaintext factors or enrollment endpoints belong here.
 * MFA remains disabled until the separate encrypted service configuration and
 * protected enrollment/recovery flows are ready.
 */
@Injectable()
export class PrismaMfaStore implements MfaStore {
  constructor(
    private readonly prisma: PrismaService,
    storage: AuthenticationStorage,
  ) {
    storage.registerSource({ mfa: this });
  }

  async getTotp(userId: string): Promise<TotpRecord | undefined> {
    const row = await this.prisma.mfaAuthenticator.findUnique({
      where: { userId, user: { deletedAt: null, status: 'ACTIVE' } },
    });
    if (!row) return undefined;
    return {
      secret: row.secret,
      confirmed: row.confirmed,
      ...(row.pendingSecret !== null ? { pendingSecret: row.pendingSecret } : {}),
      ...(row.lastUsedStep !== null ? { lastUsedStep: row.lastUsedStep } : {}),
    };
  }

  async saveTotp(userId: string, record: TotpRecord | null): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await lockActiveCredentialOwner(tx, userId);
      if (!record) {
        await tx.mfaAuthenticator.deleteMany({ where: { userId } });
        return;
      }
      // PostgreSQL GREATEST ignores NULL unless all inputs are NULL. A stale
      // record must never overwrite the latest claimed step, even on rotation.
      await tx.$executeRaw`
        INSERT INTO "mfa_authenticators"
          ("user_id", "secret", "confirmed", "pending_secret", "last_used_step")
        VALUES
          (${userId}, ${record.secret}, ${record.confirmed},
           ${record.pendingSecret ?? null}, ${record.lastUsedStep ?? null})
        ON CONFLICT ("user_id") DO UPDATE SET
          "secret" = EXCLUDED."secret",
          "confirmed" = EXCLUDED."confirmed",
          "pending_secret" = EXCLUDED."pending_secret",
          "last_used_step" = GREATEST("mfa_authenticators"."last_used_step", EXCLUDED."last_used_step")
      `;
    });
  }

  async claimTotpStep(userId: string, step: number): Promise<boolean> {
    const result = await this.prisma.mfaAuthenticator.updateMany({
      where: {
        userId,
        user: { deletedAt: null, status: 'ACTIVE' },
        OR: [{ lastUsedStep: null }, { lastUsedStep: { lt: step } }],
      },
      data: { lastUsedStep: step },
    });
    return result.count === 1;
  }

  async saveRecoveryCodes(userId: string, hashes: string[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await lockActiveCredentialOwner(tx, userId);
      await tx.mfaRecoveryCode.deleteMany({ where: { userId } });
      if (hashes.length) {
        await tx.mfaRecoveryCode.createMany({
          data: hashes.map((hash) => ({ userId, hash })),
        });
      }
    });
  }

  async consumeRecoveryCode(userId: string, hash: string): Promise<boolean> {
    const result = await this.prisma.mfaRecoveryCode.deleteMany({
      where: { userId, hash, user: { deletedAt: null, status: 'ACTIVE' } },
    });
    return result.count === 1;
  }

  async countRecoveryCodes(userId: string): Promise<number> {
    return this.prisma.mfaRecoveryCode.count({
      where: { userId, user: { deletedAt: null, status: 'ACTIVE' } },
    });
  }

  async recordMfaFailure(userId: string, windowMs: number, now: number): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      // Serialize across processes on the existing account row. The increment
      // and count commit together so a burst cannot share a low attempt count.
      await lockActiveCredentialOwner(tx, userId);
      const cutoff = new Date(now - windowMs);
      await tx.mfaFailure.deleteMany({ where: { userId, occurredAt: { lte: cutoff } } });
      await tx.mfaFailure.create({ data: { userId, occurredAt: new Date(now) } });
      return tx.mfaFailure.count({ where: { userId, occurredAt: { gt: cutoff } } });
    });
  }

  async countMfaFailures(userId: string, windowMs: number, now: number): Promise<number> {
    return this.prisma.mfaFailure.count({
      where: {
        userId,
        user: { deletedAt: null, status: 'ACTIVE' },
        occurredAt: { gt: new Date(now - windowMs) },
      },
    });
  }

  async clearMfaFailures(userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await lockActiveCredentialOwner(tx, userId);
      await tx.mfaFailure.deleteMany({ where: { userId } });
    });
  }
}
