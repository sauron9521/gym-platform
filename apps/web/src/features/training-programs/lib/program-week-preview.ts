type ProgramWorkoutDay = Readonly<{ weekNumber: number; dayNumber: number }>;

export function availableProgramWeeks(workouts: readonly ProgramWorkoutDay[]): number[] {
  return [...new Set(workouts.map((day) => day.weekNumber))]
    .filter((week) => Number.isInteger(week) && week >= 1 && week <= 52)
    .sort((a, b) => a - b);
}

/** Preserve original stable workout order, restrict filter to actual program weeks. */
export function filterProgramWorkouts<T extends ProgramWorkoutDay>(
  workouts: readonly T[],
  week: number | null,
): T[] {
  if (week === null) return [...workouts];
  if (!Number.isInteger(week) || week < 1 || week > 52) return [];
  return workouts.filter((day) => day.weekNumber === week);
}
