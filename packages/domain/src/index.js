import { calendarDayKey } from '@gym/datetime';

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

/** Account-level workout defaults; device feedback and wake locks are not included. */
export const restDurationPresets = Object.freeze([60, 90, 120]);
export const defaultWorkoutPreferences = Object.freeze({
  autoRestTimer: true,
  restDurationSeconds: 90,
});

export function isRestDuration(value) {
  return restDurationPresets.includes(value);
}

// Preserve the public domain API; technical date operations have one owner.
export const workoutCalendarDayKey = calendarDayKey;

/** Presentation only: PLANNED becomes MISSED after its scheduled civil day;
 * COMPLETED becomes COMPLETED_LATE if actually completed on a later civil
 * day. A same-day delay is not missed. Never persist these display values. */
export function workoutCalendarStatus(workout, now, timeZone) {
  const { status, scheduledAt, completedAt } = workout;
  if (status !== 'PLANNED' && status !== 'COMPLETED') return status;
  const scheduledDay = workoutCalendarDayKey(scheduledAt, timeZone);
  const today = workoutCalendarDayKey(now, timeZone);
  if (!scheduledDay || !today) return status;
  if (status === 'PLANNED') return scheduledDay < today ? 'MISSED' : status;
  const completedDay = workoutCalendarDayKey(completedAt, timeZone);
  if (!completedDay || Date.parse(completedAt) > Date.parse(now)) return status;
  return completedDay > scheduledDay ? 'COMPLETED_LATE' : status;
}
