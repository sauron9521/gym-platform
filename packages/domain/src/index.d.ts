export declare const workoutStatuses: readonly ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
export type WorkoutStatus = (typeof workoutStatuses)[number];
export declare const workoutSetStatuses: readonly ['PENDING', 'COMPLETED', 'SKIPPED'];
export type WorkoutSetStatus = (typeof workoutSetStatuses)[number];

export declare function canTransitionWorkout(from: WorkoutStatus, to: WorkoutStatus): boolean;
export declare function canCompleteWorkout(
  sets: ReadonlyArray<{ status: WorkoutSetStatus }>,
): boolean;
export declare function workoutSetProgress(sets: ReadonlyArray<{ status: WorkoutSetStatus }>): {
  completed: number;
  skipped: number;
  pending: number;
  total: number;
};
