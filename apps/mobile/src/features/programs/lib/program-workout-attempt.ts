/** Keep a failed POST's idempotency key for explicit retries of the same workout. */
export function getProgramWorkoutAttempt(
  attempts: Map<string, string>,
  assignmentId: string,
  programWorkoutId: string,
  createKey: () => string,
): string {
  const fingerprint = JSON.stringify([assignmentId, programWorkoutId]);
  const existing = attempts.get(fingerprint);
  if (existing) return existing;
  const key = createKey();
  attempts.set(fingerprint, key);
  return key;
}

export function clearProgramWorkoutAttempt(
  attempts: Map<string, string>,
  assignmentId: string,
  programWorkoutId: string,
): void {
  attempts.delete(JSON.stringify([assignmentId, programWorkoutId]));
}
