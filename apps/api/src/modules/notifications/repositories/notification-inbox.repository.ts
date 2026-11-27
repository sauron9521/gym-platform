import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '#prisma/client';
import { PrismaService } from '#src/infra/database/index';
import {
  decodeInboxCursor,
  encodeInboxCursor,
  type NotificationInboxQuery,
} from '../domain/notification-inbox.policy.js';

import { reviewInboxWhere } from '../domain/review-notification.policy.js';
import { programInboxWhere } from '../domain/program-notification.policy.js';
import { trainerInboxWhere } from '../domain/trainer-notification.policy.js';

// A single visibility predicate also protects count and mutations.
const projection = {
  id: true,
  type: true,
  category: true,
  templateKey: true,
  createdAt: true,
  readAt: true,
  programAssignmentId: true,
  trainerRelationship: { select: { id: true, trainerId: true, status: true } },
} as const;

function visible(recipientId: string, now: Date): Prisma.NotificationWhereInput {
  return {
    recipientId,
    scope: 'USER',
    recipient: { status: 'ACTIVE', deletedAt: null },
    AND: [
      { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      {
        OR: [
          {
            type: 'account.security.changed',
            category: 'ACCOUNT',
            templateKey: 'account.security.changed',
            trainerRelationshipId: null,
            programAssignmentId: null,
            trainerApplicationId: null,
          },
          ...trainerInboxWhere(recipientId),
          ...programInboxWhere(recipientId),
          ...reviewInboxWhere(recipientId),
        ],
      },
    ],
  };
}

function toInboxItem(
  {
    programAssignmentId,
    trainerRelationship,
    ...row
  }: Prisma.NotificationGetPayload<{ select: typeof projection }>,
  recipientId: string,
) {
  if (programAssignmentId)
    return { ...row, target: { kind: 'PROGRAM_ASSIGNMENT' as const, id: programAssignmentId } };
  if (
    row.type === 'trainer.invitation.accepted' &&
    trainerRelationship?.status === 'ACTIVE' &&
    trainerRelationship.trainerId === recipientId
  ) {
    return {
      ...row,
      target: { kind: 'TRAINER_RELATIONSHIP' as const, id: trainerRelationship.id },
    };
  }
  return row;
}

@Injectable()
export class NotificationInboxRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(recipientId: string, query: NotificationInboxQuery) {
    const limit = Number(query.limit ?? '20');
    const cursor = query.cursor ? decodeInboxCursor(query.cursor) : undefined;
    const rows = await this.prisma.notification.findMany({
      where: {
        AND: [
          visible(recipientId, new Date()),
          ...(query.category ? [{ category: query.category }] : []),
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
    return {
      data: data.map((row) => toInboxItem(row, recipientId)),
      nextCursor: rows.length > limit ? encodeInboxCursor(data.at(-1)!) : null,
    };
  }

  async unreadCount(recipientId: string) {
    return {
      count: await this.prisma.notification.count({
        where: { ...visible(recipientId, new Date()), readAt: null },
      }),
    };
  }

  async detail(recipientId: string, id: string) {
    const row = await this.prisma.notification.findFirst({
      where: { ...visible(recipientId, new Date()), id },
      select: projection,
    });
    if (!row) throw new NotFoundException('Notification not found');
    return toInboxItem(row, recipientId);
  }

  async markRead(recipientId: string, id: string) {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const where = { ...visible(recipientId, now), id };
      await tx.notification.updateMany({
        where: { ...where, readAt: null },
        data: { readAt: now },
      });
      const row = await tx.notification.findFirst({ where, select: projection });
      if (!row) throw new NotFoundException('Notification not found');
      return toInboxItem(row, recipientId);
    });
  }

  async markAllRead(recipientId: string) {
    const now = new Date();
    await this.prisma.notification.updateMany({
      where: { ...visible(recipientId, now), readAt: null, createdAt: { lte: now } },
      data: { readAt: now },
    });
  }
}
