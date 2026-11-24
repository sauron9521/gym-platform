export type StartWorkoutCommand = {
  id: string;
  athleteId: string;
  startedAt: Date;
};

/** A conditional start write no longer matches the requested state. */
export class WorkoutStartStateChanged extends Error {
  constructor() {
    super('Workout state has changed. Reload and try again.');
    this.name = 'WorkoutStartStateChanged';
  }
}
