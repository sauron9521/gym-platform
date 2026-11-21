import type { Prisma } from '#prisma/client';

/**
 * Full relationship contact details are available to the relationship's
 * current athlete, or to its still-authorized trainer while it remains open.
 *
 * SQL repeats the account and TrainerProfile checks at read time so a
 * moderation change between capability lookup and row lookup cannot restore
 * access to another person's email.
 */
export function fullRelationshipReadWhere(
  actorId: string,
  hasTrainerCapability: boolean,
): Prisma.TrainerAthleteWhereInput {
  const allowed: Prisma.TrainerAthleteWhereInput[] = [
    {
      athleteId: actorId,
      athlete: { is: { deletedAt: null, role: { not: 'ADMIN' } } },
    },
  ];

  if (hasTrainerCapability) {
    allowed.push({
      trainerId: actorId,
      status: { in: ['ACTIVE', 'PENDING'] },
      trainer: {
        is: {
          deletedAt: null,
          role: { not: 'ADMIN' },
          OR: [
            { trainerProfile: { is: { isActive: true } } },
            { role: 'TRAINER', trainerProfile: { is: null } },
          ],
        },
      },
    });
  }

  return { OR: allowed };
}
