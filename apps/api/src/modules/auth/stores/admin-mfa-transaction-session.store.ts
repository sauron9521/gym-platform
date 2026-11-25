import type { SessionRecord, SessionStore } from '@nestjs/authentication';

import type { Prisma } from '#prisma/client';
import { ADMIN_SESSION_PURPOSE } from '#src/common/auth/admin-session-purpose.guard';
import {
  ADMIN_SESSION_ABSOLUTE_TTL_MS,
  capAdminSessionExpiry,
  isAdminSessionExpired,
} from '#src/common/auth/admin-session-lifetime.policy';
import { toSessionRecord } from '../mappers/auth-session.mapper.js';
import { authSessionSelect } from '../selects/auth-session.select.js';

export const ADMIN_MFA_PENDING_TTL_MS = 5 * 60 * 1000;

/**
 * Private, transaction-bound adapter. Never register with the global auth
 * storage. Only the locked enrolled Admin can receive a challenge session,
 * and only the successful proof path constructs a verified writer.
 */
export class AdminMfaTransactionSessionStore implements SessionStore {
  constructor(
    private readonly tx: Prisma.TransactionClient,
    private readonly ownerId: string,
    private readonly state: 'pending' | 'verified',
  ) {}

  private assertOwner(userId: string): void {
    if (userId !== this.ownerId) throw new Error('Admin MFA session owner mismatch');
  }

  private scope(id: string) {
    return {
      id,
      userId: this.ownerId,
      metadata: { path: ['purpose'], equals: ADMIN_SESSION_PURPOSE },
    };
  }

  async getSession(id: string): Promise<SessionRecord | undefined> {
    const row = await this.tx.session.findFirst({
      where: { ...this.scope(id), mfa: { in: ['pending', 'verified'] } },
      select: authSessionSelect,
    });
    if (!row) return undefined;
    const session = toSessionRecord(row);
    if (isAdminSessionExpired(session, Date.now())) return undefined;
    return session;
  }

  async createSession(record: SessionRecord): Promise<void> {
    this.assertOwner(record.userId);
    if (record.metadata?.purpose !== ADMIN_SESSION_PURPOSE || record.mfa !== this.state) {
      throw new Error('Admin MFA session state mismatch');
    }
    capAdminSessionExpiry(record);
    if (this.state === 'pending') {
      record.expiresAt = new Date(
        Math.min(
          record.expiresAt.getTime(),
          record.createdAt.getTime() + ADMIN_MFA_PENDING_TTL_MS,
        ),
      );
    } else {
      // Rotation retains the original password-authentication time.
      record.expiresAt = new Date(record.createdAt.getTime() + ADMIN_SESSION_ABSOLUTE_TTL_MS);
    }
    await this.tx.session.create({
      data: {
        id: record.id,
        userId: record.userId,
        createdAt: record.createdAt,
        expiresAt: record.expiresAt,
        lastActiveAt: record.lastActiveAt,
        mfa: record.mfa,
        metadata: { purpose: ADMIN_SESSION_PURPOSE },
      },
    });
  }

  async touchSession(id: string, lastActiveAt: Date): Promise<void> {
    await this.tx.session.updateMany({
      where: { ...this.scope(id), lastActiveAt: { lt: lastActiveAt } },
      data: { lastActiveAt },
    });
  }

  async deleteSession(id: string): Promise<boolean> {
    const result = await this.tx.session.deleteMany({ where: this.scope(id) });
    return result.count === 1;
  }

  // The isolated adapter only supports challenge creation and rotation.
  async listUserSessions(userId: string): Promise<SessionRecord[]> {
    this.assertOwner(userId);
    throw new Error('Admin MFA session listing is unavailable');
  }

  async deleteUserSessions(userId: string): Promise<void> {
    this.assertOwner(userId);
    throw new Error('Admin MFA bulk deletion is unavailable');
  }
}
