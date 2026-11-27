export declare const workoutStatuses: readonly ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
export type WorkoutStatus = (typeof workoutStatuses)[number];
export declare const workoutSetStatuses: readonly ['PENDING', 'COMPLETED', 'SKIPPED'];
export type WorkoutSetStatus = (typeof workoutSetStatuses)[number];

export declare function canTransitionWorkout(from: WorkoutStatus, to: WorkoutStatus): boolean;
export type WorkoutCompletionFailure = 'UNPROCESSED_SETS' | 'NO_COMPLETED_SET';
export declare function workoutCompletionFailure(
  sets: ReadonlyArray<{ status: WorkoutSetStatus }>,
): WorkoutCompletionFailure | null;
export declare function canCompleteWorkout(
  sets: ReadonlyArray<{ status: WorkoutSetStatus }>,
): boolean;
export declare function workoutSetProgress(sets: ReadonlyArray<{ status: WorkoutSetStatus }>): {
  completed: number;
  skipped: number;
  pending: number;
  total: number;
};

export declare const restDurationPresets: readonly [60, 90, 120];
export type RestDuration = (typeof restDurationPresets)[number];
export type WorkoutPreferences = {
  autoRestTimer: boolean;
  restDurationSeconds: RestDuration;
};
export declare const defaultWorkoutPreferences: Readonly<WorkoutPreferences>;
export declare function isRestDuration(value: unknown): value is RestDuration;

export type WorkoutCalendarStatus = WorkoutStatus | 'MISSED' | 'COMPLETED_LATE';
export declare function workoutCalendarDayKey(
  instant: string | null | undefined,
  timeZone?: string,
): string | null;
export declare function workoutCalendarStatus(
  workout: Readonly<{
    status: WorkoutStatus;
    scheduledAt?: string | null;
    completedAt?: string | null;
  }>,
  now: string,
  timeZone?: string,
): WorkoutCalendarStatus;
