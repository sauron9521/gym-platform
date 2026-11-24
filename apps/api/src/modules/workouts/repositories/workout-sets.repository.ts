import { Injectable } from '@nestjs/common';

import { Prisma } from '#prisma/client';
import { PrismaService } from '#src/infra/database/index';
import {
  WorkoutSetStateChanged,
  type WorkoutSetResultChanges,
} from '../application/workout-set-result.js';
import { workoutSetSelect } from '../selects/workout.select.js';

type SetWriteContext = {
  workoutId: string;
  athleteId: string;
  authorize: (tx: Prisma.TransactionClient) => Promise<void>;
};

/** Set writes lock the current account, then the parent workout through commit. */
@Injectable()
export class WorkoutSetsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async updateSet(
    id: string,
    data: WorkoutSetResultChanges,
    context: SetWriteContext,
  ) {
    try {
      return await this.updateSetAtomically(id, data, context);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new WorkoutSetStateChanged();
      }
      throw error;
    }
  }

  private async updateSetAtomically(
    id: string,
    data: WorkoutSetResultChanges,
    context: SetWriteContext,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Moderation and set writes serialize on the account privilege lock.
      await context.authorize(tx);

      // Lock the parent workout while checking BOTH route and athlete scope.
      const workouts = await tx.$queryRaw<Array<{ id: string; status: string }>>`
      SELECT
        w."id",
        w."status"
      FROM "workouts" AS w
      INNER JOIN "workout_exercises" AS we
        ON we."workout_id" = w."id"
      INNER JOIN "workout_sets" AS ws
        ON ws."workout_exercise_id" = we."id"
      WHERE ws."id" = ${id}
        AND w."id" = ${context.workoutId}
        AND w."athlete_id" = ${context.athleteId}
      FOR UPDATE OF w
    `;

      if (workouts.length !== 1 || workouts[0].status !== 'IN_PROGRESS') {
        return null;
      }

      // This update executes while holding the workout lock.
      return tx.workoutSet.update({
        where: { id },
        data,
        select: workoutSetSelect,
      });
    });
  }
}
