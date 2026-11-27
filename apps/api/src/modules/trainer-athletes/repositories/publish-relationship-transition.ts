import type { Prisma, TrainerAthleteStatus } from '#prisma/client';
import { publishOutboxEvent, type OutboxEventInput } from '#src/modules/notifications/public-api';

type Transition = {
  id: string;
  trainerId: string;
  athleteId: string;
  initiatedById: string;
  status: TrainerAthleteStatus;
  createdAt: Date;
  respondedAt: Date | null;
  endedAt: Date | null;
  endedById: string | null;
};

export async function publishRelationshipTransition(tx: Prisma.TransactionClient, row: Transition) {
  const counterpart = row.initiatedById === row.trainerId ? row.athleteId : row.trainerId;
  const transitions = {
    PENDING: ['trainer.invitation.created', row.initiatedById, row.createdAt],
    ACTIVE: ['trainer.invitation.accepted', counterpart, row.respondedAt],
    DECLINED: ['trainer.invitation.declined', counterpart, row.respondedAt],
    CANCELLED: ['trainer.invitation.cancelled', row.endedById, row.endedAt],
    TERMINATED: ['trainer.relationship.terminated', row.endedById, row.endedAt],
  } as const;
  const [type, actorUserId, occurredAt] = transitions[row.status];
  if (!actorUserId || !occurredAt || ![row.trainerId, row.athleteId].includes(actorUserId)) {
    throw new Error('Invalid relationship transition');
  }
  const event: OutboxEventInput = {
    type,
    schemaVersion: 1,
    occurredAt,
    actorUserId,
    payload: { aggregate: { kind: 'TrainerAthlete', id: row.id } },
  };
  await publishOutboxEvent(tx, event);
}
