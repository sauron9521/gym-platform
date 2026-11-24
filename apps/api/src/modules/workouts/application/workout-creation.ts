/** A keyed creation lost a unique write; reconciliation must find the committed winner. */
export class WorkoutCreationUniqueConflict extends Error {
  constructor(readonly original: Error) {
    super('Workout creation encountered a unique constraint conflict.', { cause: original });
    this.name = 'WorkoutCreationUniqueConflict';
  }
}
