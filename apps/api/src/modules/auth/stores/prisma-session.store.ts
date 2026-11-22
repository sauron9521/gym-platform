import { Injectable } from '@nestjs/common';
import {
  AuthenticationStorage,
  type SessionRecord,
  type SessionStore,
} from '@nestjs/authentication';
import { Prisma } from '#prisma/client';
import { authSessionSelect } from '../selects/auth-session.select.js';
import { toSessionRecord } from '../mappers/auth-session.mapper.js';
import { PrismaService } from '#src/infra/database/index';
import { lockActiveCredentialOwner } from './lock-active-credential-owner.js';

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
      where: { id, user: { deletedAt: null, status: 'ACTIVE' } },
      select: authSessionSelect,
    });

    return session ? toSessionRecord(session) : undefined;
  }

  async createSession(record: SessionRecord): Promise<void> {
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
      await tx.session.create({ data });
    });
  }

  async touchSession(id: string, lastActiveAt: Date): Promise<void> {
    await this.prisma.session.updateMany({
      where: {
        id,
        user: { deletedAt: null, status: 'ACTIVE' },
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
      where: { userId, user: { deletedAt: null, status: 'ACTIVE' } },
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

  async deleteUserSessions(userId: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: { userId },
    });
  }
}
