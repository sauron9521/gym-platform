/** Keep planned-workout title validation aligned with PATCH /workouts/{id}. */
export function workoutTitleError(value: string): string | null {
  const length = value.trim().length;
  return length < 2 || length > 120 ? 'Назва має містити від 2 до 120 символів.' : null;
}
