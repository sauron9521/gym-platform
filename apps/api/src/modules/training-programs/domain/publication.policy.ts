const publicationMessages = {
  EMPTY_PROGRAM: 'A program must contain at least one workout',
  WORKOUT_OUTSIDE_DURATION: 'A workout week cannot exceed the program duration',
  EMPTY_WORKOUT: 'Every program workout must contain at least one exercise',
  EMPTY_EXERCISE: 'Every program exercise must contain at least one set',
} as const;

export type ProgramPublicationErrorCode = keyof typeof publicationMessages;

export class ProgramPublicationError extends Error {
  constructor(readonly code: ProgramPublicationErrorCode) {
    super(publicationMessages[code]);
    this.name = 'ProgramPublicationError';
  }
}

export type PublishableVersion = {
  durationWeeks: number | null;
  workouts: ReadonlyArray<{
    weekNumber: number;
    exercises: ReadonlyArray<{ sets: ReadonlyArray<unknown> }>;
  }>;
};

/**
 * A published program must be executable and internally consistent.
 * Call this inside the publication transaction, after locking the draft row.
 */
export function assertPublishableVersion(version: PublishableVersion): void {
  if (version.workouts.length === 0) {
    throw new ProgramPublicationError('EMPTY_PROGRAM');
  }

  for (const workout of version.workouts) {
    if (version.durationWeeks !== null && workout.weekNumber > version.durationWeeks) {
      throw new ProgramPublicationError('WORKOUT_OUTSIDE_DURATION');
    }

    if (workout.exercises.length === 0) {
      throw new ProgramPublicationError('EMPTY_WORKOUT');
    }

    for (const exercise of workout.exercises) {
      if (exercise.sets.length === 0) {
        throw new ProgramPublicationError('EMPTY_EXERCISE');
      }
    }
  }
}
