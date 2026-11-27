import type { Prisma } from '#prisma/client';
import type { ReviewEventType, ValidatedOutboxEvent } from '../domain/outbox-event.policy.js';
import { reviewSourceWhere } from '../domain/review-notification.policy.js';

type Event = Extract<ValidatedOutboxEvent, { type: ReviewEventType }>;

export async function resolveReviewNotification(tx: Prisma.TransactionClient, event: Event) {
  const id = event.payload.aggregate.id;
  const locked = await tx.$queryRaw<
    { id: string }[]
  >`SELECT id FROM trainer_applications WHERE id = ${id} FOR SHARE`;
  if (!locked.length) return { result: 'skipped', code: 'SOURCE_INELIGIBLE' } as const;
  const row = await tx.trainerApplication.findUniqueOrThrow({
    where: { id },
    select: {
      status: true,
      userId: true,
      reviewerId: true,
      reviewedAt: true,
      revokedById: true,
      revokedAt: true,
    },
  });
  const revoked = event.type === 'trainer.application.revoked';
  if (revoked ? row.status !== 'REVOKED' : !['APPROVED', 'REJECTED'].includes(row.status)) {
    return { result: 'skipped', code: 'SOURCE_INELIGIBLE' } as const;
  }
  const actor = revoked ? row.revokedById : row.reviewerId;
  const at = revoked ? row.revokedAt : row.reviewedAt;
  if (
    !actor ||
    actor === row.userId ||
    actor !== event.actorUserId ||
    at?.getTime() !== event.occurredAt.getTime()
  ) {
    return { result: 'dead_letter', code: 'SOURCE_MISMATCH' } as const;
  }
  // Committed reviews remain valid historical events even if their reviewer
  // later loses permission. Only the applicant is a USER recipient.
  await tx.$queryRaw`SELECT id FROM users WHERE id = ${row.userId} FOR SHARE`;
  const eligible = await tx.trainerApplication.findFirst({
    where: { id, ...reviewSourceWhere(event.type, row.userId) },
    select: { id: true },
  });
  if (!eligible) return { result: 'skipped', code: 'RECIPIENT_INELIGIBLE' } as const;
  return { result: 'resolved', recipientId: row.userId, trainerApplicationId: id } as const;
}
