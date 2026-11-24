/**
 * A configured duration is an inclusive upper bound on workout weeks.
 * Null means unbounded; undefined means no duration change was requested.
 * Call against authoritative data under the existing version lock for writes.
 */
export function isWorkoutOutsideDuration(
  weekNumber: number,
  durationWeeks: number | null | undefined,
): boolean {
  return typeof durationWeeks === 'number' && weekNumber > durationWeeks;
}
