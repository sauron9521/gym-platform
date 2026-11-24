/** Pure cross-platform workout rules. API remains authoritative for all transitions. */
export const workoutStatuses = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
export const workoutSetStatuses = ['PENDING', 'COMPLETED', 'SKIPPED'];

const transitions = {
  PLANNED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransitionWorkout(from, to) {
  return transitions[from].includes(to);
}

/**
 * Match the API's terminal workout invariant:
 * at least one completed set, no remaining pending sets, and at least one set.
 * This is a pure precondition, NOT an authorization or server-side write guarantee.
 */
export function workoutCompletionFailure(sets) {
  if (sets.length === 0 || sets.some((set) => set.status === 'PENDING')) {
    return 'UNPROCESSED_SETS';
  }
  if (!sets.some((set) => set.status === 'COMPLETED')) {
    return 'NO_COMPLETED_SET';
  }
  return null;
}

export function canCompleteWorkout(sets) {
  return workoutCompletionFailure(sets) === null;
}

export function workoutSetProgress(sets) {
  const completed = sets.filter((set) => set.status === 'COMPLETED').length;
  const skipped = sets.filter((set) => set.status === 'SKIPPED').length;
  return { completed, skipped, pending: sets.length - completed - skipped, total: sets.length };
}
