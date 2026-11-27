import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '#prisma/client';
import { PrismaService } from '#src/infra/database/index';
import { adminInboxWhere, reviewOperatorIds } from '../domain/admin-notification.policy.js';
import {
  decodeInboxCursor,
  encodeInboxCursor,
  type AdminNotificationInboxQuery,
} from '../domain/notification-inbox.policy.js';

const projection = {
  id: true,
  type: true,
  category: true,
  templateKey: true,
  createdAt: true,
  readAt: true,
} as const;

@Injectable()
export class AdminNotificationInboxRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private async authorized<T>(
    recipientId: string,
    work: (
      tx: Prisma.TransactionClient,
      where: Prisma.NotificationWhereInput,
      now: Date,
    ) => Promise<T>,
  ): Promise<T> {
    if (!reviewOperatorIds(this.config.get('SUPERADMIN_USER_IDS')).includes(recipientId))
      throw new ForbiddenException('Insufficient administrative permissions');
    return this.prisma.$transaction(async (tx) => {
      const users = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM users WHERE id = ${recipientId} AND role = 'ADMIN' AND status = 'ACTIVE' AND deleted_at IS NULL FOR SHARE`;
      if (
        !users.length ||
        !reviewOperatorIds(this.config.get('SUPERADMIN_USER_IDS')).includes(recipientId)
      )
        throw new ForbiddenException('Insufficient administrative permissions');
      const now = new Date();
      return work(tx, adminInboxWhere(recipientId, now), now);
    });
  }

  list(recipientId: string, query: AdminNotificationInboxQuery) {
    return this.authorized(recipientId, async (tx, visible) => {
      const limit = Number(query.limit ?? '20');
      const cursor = query.cursor ? decodeInboxCursor(query.cursor) : undefined;
      const rows = await tx.notification.findMany({
        where: {
          AND: [
            visible,
            ...(query.unread === 'true'
              ? [{ readAt: null }]
              : query.unread === 'false'
                ? [{ readAt: { not: null } }]
                : []),
            ...(cursor
              ? [
                  {
                    OR: [
                      { createdAt: { lt: cursor.createdAt } },
                      { createdAt: cursor.createdAt, id: { lt: cursor.id } },
                    ],
                  },
                ]
              : []),
          ],
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        select: projection,
      });
      const data = rows.slice(0, limit);
      return { data, nextCursor: rows.length > limit ? encodeInboxCursor(data.at(-1)!) : null };
    });
  }

  unreadCount(recipientId: string) {
    return this.authorized(recipientId, async (tx, where) => ({
      count: await tx.notification.count({ where: { ...where, readAt: null } }),
    }));
  }

  detail(recipientId: string, id: string) {
    return this.authorized(recipientId, async (tx, visible) => {
      const row = await tx.notification.findFirst({
        where: { ...visible, id },
        select: projection,
      });
      if (!row) throw new NotFoundException('Notification not found');
      return row;
    });
  }

  markRead(recipientId: string, id: string) {
    return this.authorized(recipientId, async (tx, visible, now) => {
      const where = { ...visible, id };
      await tx.notification.updateMany({
        where: { ...where, readAt: null },
        data: { readAt: now },
      });
      const row = await tx.notification.findFirst({ where, select: projection });
      if (!row) throw new NotFoundException('Notification not found');
      return row;
    });
  }

  markAllRead(recipientId: string) {
    return this.authorized(recipientId, async (tx, visible, now) => {
      await tx.notification.updateMany({
        where: { ...visible, readAt: null, createdAt: { lte: now } },
        data: { readAt: now },
      });
    });
  }
}
