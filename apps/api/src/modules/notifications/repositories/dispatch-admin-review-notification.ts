import { Prisma } from '#prisma/client';
import { pendingReviewSource, reviewOperatorIds } from '../domain/admin-notification.policy.js';
import { adminReviewEventType, type ValidatedOutboxEvent } from '../domain/outbox-event.policy.js';

type Event = Extract<ValidatedOutboxEvent, { type: typeof adminReviewEventType }>;

export async function dispatchAdminReviewNotification(
  tx: Prisma.TransactionClient,
  eventId: string,
  event: Event,
  config: unknown,
) {
  const id = event.payload.aggregate.id;
  const locked = await tx.$queryRaw<
    { id: string }[]
  >`SELECT id FROM trainer_applications WHERE id = ${id} FOR SHARE`;
  if (!locked.length) return { result: 'skipped', code: 'SOURCE_INELIGIBLE' } as const;
  const source = await tx.trainerApplication.findUniqueOrThrow({
    where: { id },
    select: { userId: true, createdAt: true },
  });
  if (
    source.userId !== event.actorUserId ||
    source.createdAt.getTime() !== event.occurredAt.getTime()
  ) {
    return { result: 'dead_letter', code: 'SOURCE_MISMATCH' } as const;
  }
  const candidates = reviewOperatorIds(config).filter((candidate) => candidate !== source.userId);
  if (!candidates.length) return { result: 'skipped', code: 'RECIPIENT_INELIGIBLE' } as const;
  await tx.$queryRaw`SELECT id FROM users WHERE id IN (${Prisma.join([...candidates, source.userId].sort())}) ORDER BY id FOR SHARE`;
  const eligible = await tx.trainerApplication.findFirst({
    where: { id, ...pendingReviewSource },
    select: { id: true },
  });
  if (!eligible) return { result: 'skipped', code: 'SOURCE_INELIGIBLE' } as const;
  const operators = await tx.user.findMany({
    where: { id: { in: candidates }, role: 'ADMIN', status: 'ACTIVE', deletedAt: null },
    select: { id: true },
  });
  if (!operators.length) return { result: 'skipped', code: 'RECIPIENT_INELIGIBLE' } as const;
  // Outbox row lock serializes fanout. Validate replay before inserting
  // anything, so a conflicting existing row cannot commit partial fanout.
  const existing = await tx.notification.findMany({
    where: { eventId, scope: 'ADMIN' },
    select: {
      type: true,
      templateKey: true,
      category: true,
      trainerApplicationId: true,
      trainerRelationshipId: true,
      programAssignmentId: true,
      resourceId: true,
      resourceType: true,
    },
  });
  if (
    existing.some(
      (row) =>
        row.type !== event.type ||
        row.templateKey !== event.type ||
        row.category !== 'ACCOUNT' ||
        row.trainerApplicationId !== id ||
        row.trainerRelationshipId !== null ||
        row.programAssignmentId !== null ||
        row.resourceId !== null ||
        row.resourceType !== null,
    )
  ) {
    return { result: 'dead_letter', code: 'INBOX_CONFLICT' } as const;
  }
  await tx.notification.createMany({
    data: operators.map((operator) => ({
      eventId,
      recipientId: operator.id,
      scope: 'ADMIN',
      category: 'ACCOUNT',
      type: event.type,
      templateKey: event.type,
      trainerApplicationId: id,
    })),
    skipDuplicates: true,
  });
  return { result: 'processed', code: null } as const;
}
