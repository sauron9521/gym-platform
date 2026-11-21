type ExerciseDailyResult = Readonly<{
  date: string;
  workoutCount: number;
  bestWeightKg: number | null;
  strengthVolumeKg: number;
}>;

function safeNonnegative(value: number): number {
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function isValidWeight(weight: number | null): weight is number {
  return weight !== null && Number.isFinite(weight) && weight >= 0;
}

/** Derived from the authenticated exercise analytics response; no extra API requests. */
export function exercisePersonalBests(days: readonly ExerciseDailyResult[]) {
  const weights = days.map((day) => day.bestWeightKg).filter(isValidWeight);
  const activeDays = days.filter(
    (day) => Number.isFinite(day.workoutCount) && day.workoutCount > 0,
  ).length;
  const top = days.reduce<{ date: string; volumeKg: number } | null>((best, day) => {
    const volumeKg = safeNonnegative(day.strengthVolumeKg);
    if (!best || volumeKg > best.volumeKg) return { date: day.date, volumeKg };
    return best;
  }, null);

  return {
    bestWeightKg: weights.length > 0 ? Math.max(...weights) : null,
    activeDays,
    // A 0-volume activity day has no strength-volume record.
    bestVolumeDay: top && top.volumeKg > 0 ? top : null,
  };
}
