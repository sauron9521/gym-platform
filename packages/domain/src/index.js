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

/** Compare civil calendar dates, not 24-hour windows. The caller supplies
 * its calendar zone (or omits it for the current device-local zone).
 * Invalid or absent schedule evidence never invents a derived status. */
export function workoutCalendarDayKey(instant, timeZone) {
  if (typeof instant !== 'string') return null;
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.exec(
      instant,
    );
  if (!match) return null;
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > monthDays[month - 1] ||
    hour > 23 ||
    minute > 59 ||
    (Number.isFinite(second) && second > 59)
  )
    return null;
  const date = new Date(instant);
  if (!Number.isFinite(date.getTime())) return null;
  if (timeZone === undefined) {
    // Match the existing device-local calendar arithmetic without repeatedly
    // constructing an Intl formatter for every workout in a large month.
    return [
      String(date.getFullYear()).padStart(4, '0'),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
  }
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      calendar: 'gregory',
      numberingSystem: 'latn',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const part = (type) => parts.find((entry) => entry.type === type)?.value;
    const year = part('year'),
      month = part('month'),
      day = part('day');
    return year && month && day ? year.padStart(4, '0') + '-' + month + '-' + day : null;
  } catch {
    return null;
  }
}

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
