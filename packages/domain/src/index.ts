/** Pure cross-platform workout rules. API remains authoritative for all transitions. */
export const workoutStatuses = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
export type WorkoutStatus = (typeof workoutStatuses)[number];
export const workoutSetStatuses = ['PENDING', 'COMPLETED', 'SKIPPED'] as const;
export type WorkoutSetStatus = (typeof workoutSetStatuses)[number];

const transitions: Record<WorkoutStatus, readonly WorkoutStatus[]> = {
  PLANNED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransitionWorkout(from: WorkoutStatus, to: WorkoutStatus): boolean {
  return transitions[from].includes(to);
}

/**
 * Match the API's terminal workout invariant:
 * at least one completed set, no remaining pending sets, and at least one set.
 * This is a UI precondition, NOT an authorization or server-side write guarantee.
 */
export function canCompleteWorkout(sets: ReadonlyArray<{ status: WorkoutSetStatus }>): boolean {
  return (
    sets.length > 0 &&
    !sets.some((set) => set.status === 'PENDING') &&
    sets.some((set) => set.status === 'COMPLETED')
  );
}

export function workoutSetProgress(sets: ReadonlyArray<{ status: WorkoutSetStatus }>) {
  const completed = sets.filter((set) => set.status === 'COMPLETED').length;
  const skipped = sets.filter((set) => set.status === 'SKIPPED').length;
  return { completed, skipped, pending: sets.length - completed - skipped, total: sets.length };
}
