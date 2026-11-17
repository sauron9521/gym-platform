/** Return an additional page only when API pagination metadata is valid. */
export function nextExercisePage(totalPages: number, current: number): number | undefined {
  if (!Number.isInteger(totalPages) || !Number.isInteger(current) || current < 1) {
    return undefined;
  }
  return current < totalPages ? current + 1 : undefined;
}
