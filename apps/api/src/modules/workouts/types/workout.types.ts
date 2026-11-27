import type { Prisma, WorkoutSetType, WorkoutStatus } from '#prisma/client';
import type { workoutSelect } from '../selects/workout.select.js';

import type { WorkoutSetResultInput } from '../application/workout-set-result.js';
import type { ExerciseActor } from '#src/modules/exercises/public-api';

export type WorkoutActor = ExerciseActor;

type CreateWorkoutSetInput = {
  setType?: WorkoutSetType;

  plannedReps?: number | null;
  plannedWeightKg?: number | null;
  plannedDurationSeconds?: number | null;
  plannedDistanceMeters?: number | null;

  restSeconds?: number | null;
  targetRpe?: number | null;
  targetRir?: number | null;
};

type CreateWorkoutExerciseInput = {
  exerciseId: string;
  notes?: string | null;
  sets: CreateWorkoutSetInput[];
};

export type CreateWorkoutInput = {
  title: string;
  notes?: string | null;
  scheduledAt?: Date | null;
  exercises: CreateWorkoutExerciseInput[];
};

export type UpdateWorkoutInput = {
  title?: string;
  notes?: string | null;
  scheduledAt?: Date | null;
};

export type UpdateWorkoutSetInput = WorkoutSetResultInput;

export type WorkoutListQuery = {
  page: number;
  limit: number;
  status?: WorkoutStatus;
  view?: 'summary' | 'full';
  sort?: 'scheduledAtAsc' | 'completedAtDesc';
  scheduledFrom?: Date;
  scheduledTo?: Date;
};

export type CreateWorkoutFromProgramInput = {
  assignmentId: string;
  programWorkoutId: string;
  scheduledAt?: Date | null;
};

/** Public Prisma-projected API records (no repository ReturnType coupling). */
export type WorkoutRecord = Prisma.WorkoutGetPayload<{
  select: typeof workoutSelect;
}>;

export type FindManyWorkoutsParams = {
  where?: Prisma.WorkoutWhereInput;
  skip: number;
  take: number;
  orderBy?: Prisma.WorkoutOrderByWithRelationInput[];
};
