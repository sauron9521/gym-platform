export type WorkoutSetResultInput = {
  status: 'COMPLETED' | 'SKIPPED';

  actualReps?: number | null;
  actualWeightKg?: number | null;
  actualDurationSeconds?: number | null;
  actualDistanceMeters?: number | null;

  restSeconds?: number | null;
  rpe?: number | null;
  rir?: number | null;

  notes?: string | null;
};

export type WorkoutSetResultChanges = WorkoutSetResultInput & { completedAt: Date };

export class SkippedSetPerformanceError extends Error {
  constructor() {
    super('A skipped set cannot contain actual performance values');
    this.name = 'SkippedSetPerformanceError';
  }
}

export class WorkoutSetStateChanged extends Error {
  constructor() {
    super('Workout set state has changed. Reload and try again.');
    this.name = 'WorkoutSetStateChanged';
  }
}

/** Preserve omitted fields, explicit clears and numeric zero without ORM types. */
export function normalizeWorkoutSetResult(
  input: WorkoutSetResultInput,
  completedAt: Date,
): WorkoutSetResultChanges {
  const actualFields = [
    input.actualReps,
    input.actualWeightKg,
    input.actualDurationSeconds,
    input.actualDistanceMeters,
    input.rpe,
    input.rir,
  ];

  if (
    input.status === 'SKIPPED' &&
    actualFields.some((value) => value !== undefined && value !== null)
  ) {
    throw new SkippedSetPerformanceError();
  }

  const data: WorkoutSetResultChanges = {
    status: input.status,
    completedAt,
  };

  if (input.status === 'SKIPPED') {
    data.actualReps = null;
    data.actualWeightKg = null;
    data.actualDurationSeconds = null;
    data.actualDistanceMeters = null;
    data.rpe = null;
    data.rir = null;
  } else {
    if (input.actualReps !== undefined) {
      data.actualReps = input.actualReps;
    }

    if (input.actualWeightKg !== undefined) {
      data.actualWeightKg = input.actualWeightKg;
    }

    if (input.actualDurationSeconds !== undefined) {
      data.actualDurationSeconds = input.actualDurationSeconds;
    }

    if (input.actualDistanceMeters !== undefined) {
      data.actualDistanceMeters = input.actualDistanceMeters;
    }
  }

  if (input.restSeconds !== undefined) {
    data.restSeconds = input.restSeconds;
  }

  if (input.rpe !== undefined) {
    data.rpe = input.rpe;
  }

  if (input.rir !== undefined) {
    data.rir = input.rir;
  }

  if (input.notes !== undefined) {
    data.notes = input.notes;
  }

  return data;
}
