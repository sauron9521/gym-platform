import { Injectable } from '@nestjs/common';

import { Prisma } from '#prisma/client';
import { PrismaService } from '#src/infra/database/index';
import { workoutSelect } from '../selects/workout.select.js';
import { WorkoutQueriesRepository } from './workout-queries.repository.js';
import { WorkoutCreationRepository } from './workout-creation.repository.js';
import { WorkoutLifecycleRepository } from './workout-lifecycle.repository.js';
import { WorkoutSetsRepository } from './workout-sets.repository.js';

@Injectable()
export class WorkoutsRepository extends WorkoutQueriesRepository {
  constructor(
    prisma: PrismaService,
    private readonly creationRepository: WorkoutCreationRepository,
    private readonly lifecycleRepository: WorkoutLifecycleRepository,
    private readonly setsRepository: WorkoutSetsRepository,
  ) {
    super(prisma);
  }

  create(
    data: Prisma.WorkoutCreateInput,
    athleteId: string,
    exerciseIds: string[],
    authorize: (tx: Prisma.TransactionClient) => Promise<void>,
  ) {
    return this.creationRepository.create(data, athleteId, exerciseIds, authorize);
  }

  createFromProgram(input: Parameters<WorkoutCreationRepository['createFromProgram']>[0]) {
    return this.creationRepository.createFromProgram(input);
  }

  // UPDATE
  async update(
    where: Prisma.WorkoutWhereUniqueInput,
    data: Prisma.WorkoutUpdateInput,
    authorize: (tx: Prisma.TransactionClient) => Promise<void>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Hold the account permission locks until the conditional write commits.
      await authorize(tx);
      return tx.workout.update({
        where,
        data,
        select: workoutSelect,
      });
    });
  }

  updateSet(
    id: string,
    data: Prisma.WorkoutSetUpdateInput,
    context: Parameters<WorkoutSetsRepository['updateSet']>[2],
  ) {
    return this.setsRepository.updateSet(id, data, context);
  }

  completeWorkout(input: Parameters<WorkoutLifecycleRepository['completeWorkout']>[0]) {
    return this.lifecycleRepository.completeWorkout(input);
  }

  startWorkout(input: Parameters<WorkoutLifecycleRepository['startWorkout']>[0]) {
    return this.lifecycleRepository.startWorkout(input);
  }
}
