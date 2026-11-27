import type { Prisma } from '#prisma/client';
import { Prisma as PrismaSql } from '#prisma/client';
import type { TrainerEventType, ValidatedOutboxEvent } from '../domain/outbox-event.policy.js';
import {
  trainerEventStatus,
  trainerNotificationSourceWhere,
} from '../domain/trainer-notification.policy.js';

type Event = Extract<ValidatedOutboxEvent, { type: TrainerEventType }>;

export async function resolveTrainerNotification(tx: Prisma.TransactionClient, event: Event) {
  const id = event.payload.aggregate.id;
  const locked = await tx.$queryRaw<
    { id: string }[]
  >`SELECT id FROM trainer_athletes WHERE id = ${id} FOR SHARE`;
  if (!locked.length) return { result: 'skipped', code: 'SOURCE_INELIGIBLE' } as const;
  const source = await tx.trainerAthlete.findUniqueOrThrow({
    where: { id },
    select: {
      id: true,
      trainerId: true,
      athleteId: true,
      initiatedById: true,
      status: true,
      createdAt: true,
      respondedAt: true,
      endedAt: true,
      endedById: true,
    },
  });
  if (source.status !== trainerEventStatus(event.type))
    return { result: 'skipped', code: 'SOURCE_INELIGIBLE' } as const;
  const participants = [source.trainerId, source.athleteId];
  if (source.trainerId === source.athleteId || !participants.includes(source.initiatedById))
    return { result: 'dead_letter', code: 'SOURCE_MISMATCH' } as const;
  const counterpart = (actor: string) =>
    actor === source.trainerId ? source.athleteId : source.trainerId;
  const actor =
    event.type === 'trainer.invitation.created'
      ? source.initiatedById
      : event.type === 'trainer.invitation.accepted' || event.type === 'trainer.invitation.declined'
        ? counterpart(source.initiatedById)
        : source.endedById;
  const at =
    event.type === 'trainer.invitation.created'
      ? source.createdAt
      : event.type === 'trainer.invitation.accepted' || event.type === 'trainer.invitation.declined'
        ? source.respondedAt
        : source.endedAt;
  if (
    !actor ||
    !participants.includes(actor) ||
    actor !== event.actorUserId ||
    at?.getTime() !== event.occurredAt.getTime() ||
    (event.type === 'trainer.invitation.cancelled' && actor !== source.initiatedById)
  ) {
    return { result: 'dead_letter', code: 'SOURCE_MISMATCH' } as const;
  }
  // Hold source and participant/profile locks through Inbox commit; the
  // same predicate is re-evaluated on every subsequent Inbox operation.
  await tx.$queryRaw`SELECT id FROM users WHERE id IN (${PrismaSql.join(participants.sort())}) ORDER BY id FOR SHARE`;
  await tx.$queryRaw`SELECT id FROM trainer_profiles WHERE user_id = ${source.trainerId} FOR SHARE`;
  const recipientId = counterpart(actor);
  const eligible = await tx.trainerAthlete.findFirst({
    where: { id, ...trainerNotificationSourceWhere(event.type, recipientId) },
    select: { id: true },
  });
  if (!eligible) return { result: 'skipped', code: 'RECIPIENT_INELIGIBLE' } as const;
  return { result: 'resolved', recipientId, trainerRelationshipId: id } as const;
}
