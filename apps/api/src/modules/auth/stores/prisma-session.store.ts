import { Injectable } from '@nestjs/common';
import {
  AuthenticationStorage,
  type SessionRecord,
  type SessionStore,
} from '@nestjs/authentication';
import { Prisma } from '#prisma/client';
import { authSessionSelect } from '../selects/auth-session.select.js';
import { toSessionRecord } from '../mappers/auth-session.mapper.js';
import {
  capAdminSessionExpiry,
  isAdminSessionExpired,
} from '#src/common/auth/admin-session-lifetime.policy';
import { PrismaService } from '#src/infra/database/index';
import { PASSWORD_ONLY_OWNER_FILTER } from '#src/common/auth/password-only-owner.filter';
import {
  assertPasswordOnlyCredentialOwner,
  lockActiveCredentialOwner,
} from './lock-active-credential-owner.js';

@Injectable()
export class PrismaSessionStore implements SessionStore {
  constructor(
    private readonly prisma: PrismaService,
    storage: AuthenticationStorage,
  ) {
    // Реєструємо власне сховище сесій у @nestjs/authentication.
    storage.registerSource({ sessions: this });
  }

  async getSession(id: string): Promise<SessionRecord | undefined> {
    const session = await this.prisma.session.findUnique({
      where: {
        id,
        user: { deletedAt: null, status: 'ACTIVE', ...PASSWORD_ONLY_OWNER_FILTER },
      },
      select: authSessionSelect,
    });

    const record = session ? toSessionRecord(session) : undefined;
    if (!record || isAdminSessionExpired(record, Date.now())) return undefined;
    return record;
  }

  async createSession(record: SessionRecord): Promise<void> {
    capAdminSessionExpiry(record);
    const data: Prisma.SessionUncheckedCreateInput = {
      id: record.id,
      userId: record.userId,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      lastActiveAt: record.lastActiveAt,
      ...(record.mfa !== undefined ? { mfa: record.mfa } : {}),
      ...(record.metadata !== undefined
        ? { metadata: record.metadata as Prisma.InputJsonValue }
        : {}),
    };

    await this.prisma.$transaction(async (tx) => {
      await lockActiveCredentialOwner(tx, record.userId);
      await assertPasswordOnlyCredentialOwner(tx, record.userId);
      await tx.session.create({ data });
    });
  }

  async touchSession(id: string, lastActiveAt: Date): Promise<void> {
    await this.prisma.session.updateMany({
      where: {
        id,
        user: { deletedAt: null, status: 'ACTIVE', ...PASSWORD_ONLY_OWNER_FILTER },
        lastActiveAt: { lt: lastActiveAt },
      },
      data: { lastActiveAt },
    });
  }

  async deleteSession(id: string): Promise<boolean> {
    const result = await this.prisma.session.deleteMany({
      where: { id },
    });

    return result.count > 0;
  }

  async listUserSessions(userId: string): Promise<SessionRecord[]> {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        user: { deletedAt: null, status: 'ACTIVE', ...PASSWORD_ONLY_OWNER_FILTER },
      },
      orderBy: { createdAt: 'desc' },
      select: authSessionSelect,
    });

    return sessions.map(toSessionRecord);
  }

  /** Remove one bounded, ordered batch without locking other sessions. */
  async deleteExpiredSessionsBatch(now: Date, batchSize: number): Promise<number> {
    return this.prisma.$executeRaw`
      WITH expired AS (
        SELECT "id"
        FROM "sessions"
        WHERE "expires_at" <= ${now}
        ORDER BY "expires_at", "id"
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      )
      DELETE FROM "sessions"
      WHERE "id" IN (SELECT "id" FROM expired)
    `;
  }

  async deleteExpiredSessions(now: Date): Promise<void> {
    await this.prisma.session.deleteMany({
      where: { expiresAt: { lte: now } },
    });
  }

  /**
   * Revoke this user's admin-purpose sessions without revoking their ordinary
   * sessions or refresh tokens. Lock the same user row as createSession so
   * session issuance cannot slip between the scoped deletion and its commit.
   * A rotation that began earlier loses the old-token delete and discards its
   * new token; a new sign-in after this call is a separate authentication.
   */
  async revokeAdminSessionsForUser(userId: string): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      await lockActiveCredentialOwner(tx, userId);
      const revoked = await tx.session.deleteMany({
        where: {
          userId,
          metadata: { path: ['purpose'], equals: 'admin' },
        },
      });
      return revoked.count;
    });
  }

  async deleteUserSessions(userId: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: { userId },
    });
  }
}
