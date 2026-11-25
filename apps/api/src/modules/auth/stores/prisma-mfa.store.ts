import { AuthenticationStorage, type MfaStore, type TotpRecord } from '@nestjs/authentication';
import { Injectable } from '@nestjs/common';

import type { Prisma } from '#prisma/client';
import { PrismaService } from '#src/infra/database/index';
import { lockActiveCredentialOwner } from './lock-active-credential-owner.js';

type OwnerWrite = <T>(
  userId: string,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
) => Promise<T>;

function ownerWrite(prisma: PrismaService): OwnerWrite {
  return (userId, work) =>
    prisma.$transaction(async (tx) => {
      await lockActiveCredentialOwner(tx, userId);
      return work(tx);
    });
}

/** Shared implementation for normal and transaction-bound library calls. */
class MfaPersistence implements MfaStore {
  constructor(
    private readonly prisma: Prisma.TransactionClient,
    private readonly write: OwnerWrite,
    private readonly boundOwner?: string,
  ) {}

  private assertOwner(userId: string): void {
    if (this.boundOwner !== undefined && this.boundOwner !== userId) {
      throw new Error('MFA owner mismatch');
    }
  }

  async getTotp(userId: string): Promise<TotpRecord | undefined> {
    this.assertOwner(userId);
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
    this.assertOwner(userId);
    await this.write(userId, async (tx) => {
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
    this.assertOwner(userId);
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
    this.assertOwner(userId);
    await this.write(userId, async (tx) => {
      await tx.mfaRecoveryCode.deleteMany({ where: { userId } });
      if (hashes.length) {
        await tx.mfaRecoveryCode.createMany({
          data: hashes.map((hash) => ({ userId, hash })),
        });
      }
    });
  }

  async consumeRecoveryCode(userId: string, hash: string): Promise<boolean> {
    this.assertOwner(userId);
    const result = await this.prisma.mfaRecoveryCode.deleteMany({
      where: { userId, hash, user: { deletedAt: null, status: 'ACTIVE' } },
    });
    return result.count === 1;
  }

  async countRecoveryCodes(userId: string): Promise<number> {
    this.assertOwner(userId);
    return this.prisma.mfaRecoveryCode.count({
      where: { userId, user: { deletedAt: null, status: 'ACTIVE' } },
    });
  }

  async recordMfaFailure(userId: string, windowMs: number, now: number): Promise<number> {
    this.assertOwner(userId);
    return this.write(userId, async (tx) => {
      // The owner lock serializes attempt accounting across processes.
      const cutoff = new Date(now - windowMs);
      await tx.mfaFailure.deleteMany({ where: { userId, occurredAt: { lte: cutoff } } });
      await tx.mfaFailure.create({ data: { userId, occurredAt: new Date(now) } });
      return tx.mfaFailure.count({ where: { userId, occurredAt: { gt: cutoff } } });
    });
  }

  async countMfaFailures(userId: string, windowMs: number, now: number): Promise<number> {
    this.assertOwner(userId);
    return this.prisma.mfaFailure.count({
      where: {
        userId,
        user: { deletedAt: null, status: 'ACTIVE' },
        occurredAt: { gt: new Date(now - windowMs) },
      },
    });
  }

  async clearMfaFailures(userId: string): Promise<void> {
    this.assertOwner(userId);
    await this.write(userId, async (tx) => {
      await tx.mfaFailure.deleteMany({ where: { userId } });
    });
  }
}

/** Durable storage for opaque sealed secrets and recovery hashes. */
@Injectable()
export class PrismaMfaStore extends MfaPersistence {
  constructor(
    private readonly database: PrismaService,
    storage: AuthenticationStorage,
  ) {
    super(database, ownerWrite(database));
    storage.registerSource({ mfa: this });
  }

  /**
   * Run a factor lifecycle operation and its session checks in one transaction.
   * Do not use the globally registered store from inside this callback.
   */
  async withLockedOwner<T>(
    userId: string,
    work: (tx: Prisma.TransactionClient, store: MfaStore) => Promise<T>,
  ): Promise<T> {
    return ownerWrite(this.database)(userId, async (tx) => {
      const write: OwnerWrite = async (id, operation) => {
        if (id !== userId) throw new Error('MFA owner mismatch');
        return operation(tx);
      };
      return work(tx, new MfaPersistence(tx, write, userId));
    });
  }
}
