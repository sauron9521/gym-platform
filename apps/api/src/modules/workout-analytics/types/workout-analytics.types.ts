import type { Prisma } from '#prisma/client';

type VolumeValue = Prisma.Decimal | number | string;

/** PostgreSQL aggregate rows. Counts are cast to int in SQL. */
export type WorkoutAnalyticsDailyRow = {
  date: string;
  workoutCount: number;
  completedSets: number;
  strengthVolumeKg: VolumeValue;
};

export type ExerciseAnalyticsDailyRow = WorkoutAnalyticsDailyRow & {
  strengthReps: number;
  bestWeightKg: VolumeValue | null;
};

export type ExerciseSnapshotRow = {
  name: string;
};

export type PersonalRecordsRow = {
  exerciseCount: number;
};

/** Minimal prior completed strength-set projection. */
export type PreviousWorkoutSetRow = {
  workoutCompletedAt: Date;
  setNumber: number;
  setType: 'WARMUP' | 'WORKING' | 'DROP_SET' | 'AMRAP';
  actualReps: number | null;
  actualWeightKg: VolumeValue | null;
};
