import type { Prisma } from '#prisma/client';

const activeParticipant = { deletedAt: null, role: { not: 'ADMIN' as const } };

const activeTrainer = {
  ...activeParticipant,
  OR: [
    { trainerProfile: { is: { isActive: true } } },
    { role: 'TRAINER' as const, trainerProfile: { is: null } },
  ],
};

/**
 * Participant-scoped, restricted reads include an eligible user's own athlete
 * history and program assignments from their trainer-side relationships.
 * Revoked trainers retain email-free records needed for audit and cleanup.
 */
export function assignmentParticipantWhere(
  actorId: string,
): Prisma.TrainingProgramAssignmentWhereInput {
  return {
    OR: [
      { athleteId: actorId, athlete: { is: activeParticipant } },
      {
        version: { program: { trainerId: actorId, trainer: { is: activeParticipant } } },
        trainerAthlete: { is: { trainerId: actorId } },
      },
    ],
  };
}

/**
 * Full read projections use these database predicates at query time (not only
 * a prior session/capability check) to avoid leaking contacts after revocation.
 * Own athlete history remains full, including ended assignments.
 */
export function assignmentFullReadWhere(
  actorId: string,
): Prisma.TrainingProgramAssignmentWhereInput {
  return {
    OR: [
      { athleteId: actorId, athlete: { is: activeParticipant } },
      {
        version: { program: { trainerId: actorId, trainer: { is: activeTrainer } } },
        trainerAthlete: { is: { trainerId: actorId, status: 'ACTIVE' } },
      },
    ],
  };
}
