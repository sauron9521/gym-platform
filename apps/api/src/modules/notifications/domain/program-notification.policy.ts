import type { Prisma, TrainingProgramAssignmentStatus } from '#prisma/client';
import { programEventTypes, type ProgramEventType } from './outbox-event.policy.js';

const statuses: Record<ProgramEventType, TrainingProgramAssignmentStatus> = {
  'program.assigned': 'ACTIVE',
  'program.assignment.cancelled': 'CANCELLED',
  'program.assignment.terminated': 'TERMINATED',
  'program.assignment.completed': 'COMPLETED',
};
const participant: Prisma.UserWhereInput = {
  status: 'ACTIVE',
  deletedAt: null,
  role: { not: 'ADMIN' },
};

export function programEventStatus(type: ProgramEventType) {
  return statuses[type];
}

/** The athlete owns their assignment history. Active notices additionally
 * require the current collaboration and trainer capability. */
export function programNotificationSourceWhere(
  type: ProgramEventType,
  recipientId: string,
): Prisma.TrainingProgramAssignmentWhereInput {
  return {
    athleteId: recipientId,
    status: statuses[type],
    athlete: { is: participant },
    trainerAthlete: {
      is: {
        athleteId: recipientId,
        ...(type === 'program.assigned'
          ? {
              status: 'ACTIVE' as const,
              trainer: {
                is: {
                  ...participant,
                  OR: [
                    { trainerProfile: { is: { isActive: true } } },
                    { role: 'TRAINER', trainerProfile: { is: null } },
                  ],
                },
              },
            }
          : {}),
      },
    },
  };
}

export function programInboxWhere(recipientId: string): Prisma.NotificationWhereInput[] {
  return programEventTypes.map((type) => ({
    type,
    category: 'PROGRAM',
    templateKey: type,
    trainerRelationshipId: null,
    programAssignment: { is: programNotificationSourceWhere(type, recipientId) },
    resourceId: null,
    resourceType: null,
  }));
}
