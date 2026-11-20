import { Injectable } from '@nestjs/common';

import type { Prisma } from '#prisma/client';
import { PrismaService } from '#src/infra/database/index';

/**
 * Fixed-count, DB-scoped aggregate reads. Never load athlete rows then count
 * in JavaScript: that would turn into an N+1 or leak other trainers' history.
 */
@Injectable()
export class TrainerDashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async countOverview(trainerId: string, from: Date, asOf: Date) {
    // Re-check current approval inside every query, including after the
    // service's capability lookup, so revocation cannot restore private data.
    const relation: Prisma.TrainerAthleteWhereInput = {
      trainerId,
      status: 'ACTIVE',
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
      athlete: { is: { deletedAt: null, role: { not: 'ADMIN' } } },
    };

    const assignment: Prisma.TrainingProgramAssignmentWhereInput = {
      status: 'ACTIVE',
      trainerAthlete: { is: relation },
      version: { is: { program: { is: { trainerId } } } },
    };

    // Exactly three aggregate queries regardless of how many clients, plans,
    // or workouts exist; the database performs all tenant and time filtering.
    const [activeClients, activeProgramAssignments, completedProgramWorkouts30d] =
      await this.prisma.$transaction([
        this.prisma.trainerAthlete.count({ where: relation }),
        this.prisma.trainingProgramAssignment.count({ where: assignment }),
        this.prisma.workout.count({
          where: {
            status: 'COMPLETED',
            completedAt: { gte: from, lt: asOf },
            programAssignment: {
              is: {
                status: { in: ['ACTIVE', 'COMPLETED'] },
                trainerAthlete: { is: relation },
                version: { is: { program: { is: { trainerId } } } },
              },
            },
          },
        }),
      ]);

    return { activeClients, activeProgramAssignments, completedProgramWorkouts30d };
  }
}
