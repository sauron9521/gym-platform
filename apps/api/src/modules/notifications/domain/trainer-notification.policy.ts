import type { Prisma, TrainerAthleteStatus } from '#prisma/client';
import { trainerEventTypes, type TrainerEventType } from './outbox-event.policy.js';

const statuses: Record<TrainerEventType, TrainerAthleteStatus> = {
  'trainer.invitation.created': 'PENDING',
  'trainer.invitation.accepted': 'ACTIVE',
  'trainer.invitation.declined': 'DECLINED',
  'trainer.invitation.cancelled': 'CANCELLED',
  'trainer.relationship.terminated': 'TERMINATED',
};

const participant: Prisma.UserWhereInput = {
  status: 'ACTIVE',
  deletedAt: null,
  role: { not: 'ADMIN' },
};
const trainer: Prisma.UserWhereInput = {
  ...participant,
  OR: [
    { trainerProfile: { is: { isActive: true } } },
    { role: 'TRAINER', trainerProfile: { is: null } },
  ],
};

// One predicate for dispatch and all Inbox reads/writes. Historical notices
// have no target; the projection may expose only an active owner-trainer target.
export function trainerNotificationSourceWhere(
  type: TrainerEventType,
  recipientId: string,
): Prisma.TrainerAthleteWhereInput {
  const status = statuses[type];
  const open = status === 'PENDING' || status === 'ACTIVE';
  const routing: Prisma.TrainerAthleteWhereInput =
    type === 'trainer.invitation.accepted' || type === 'trainer.invitation.declined'
      ? { initiatedById: recipientId }
      : type === 'trainer.relationship.terminated'
        ? { endedById: { not: recipientId } }
        : { initiatedById: { not: recipientId } };
  return {
    status,
    AND: [
      routing,
      {
        OR: [
          {
            trainerId: recipientId,
            trainer: { is: trainer },
            ...(open ? { athlete: { is: participant } } : {}),
          },
          {
            athleteId: recipientId,
            athlete: { is: participant },
            ...(open ? { trainer: { is: trainer } } : {}),
          },
        ],
      },
    ],
  };
}

export function trainerInboxWhere(recipientId: string): Prisma.NotificationWhereInput[] {
  return trainerEventTypes.map((type) => ({
    type,
    category: 'TRAINER',
    templateKey: type,
    trainerApplicationId: null,
    programAssignmentId: null,
    trainerRelationship: { is: trainerNotificationSourceWhere(type, recipientId) },
  }));
}

export function trainerEventStatus(type: TrainerEventType) {
  return statuses[type];
}
