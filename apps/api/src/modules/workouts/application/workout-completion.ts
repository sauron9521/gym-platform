export type CompleteWorkoutCommand = {
  id: string;
  athleteId: string;
  completedAt: Date;
};

export type WorkoutCompletionResult<Result> =
  | { status: 'COMPLETED'; workout: Result }
  | { status: 'NOT_IN_PROGRESS' }
  | { status: 'INVALID_SETS' };

/** A conditional completion write no longer matches the requested state. */
export class WorkoutCompletionStateChanged extends Error {
  constructor() {
    super('Workout state has changed. Reload and try again.');
    this.name = 'WorkoutCompletionStateChanged';
  }
}
