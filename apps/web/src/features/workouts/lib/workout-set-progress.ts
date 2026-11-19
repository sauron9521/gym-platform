import type { WorkoutDetailsData } from './workout-details';

type WorkoutExercises = Pick<WorkoutDetailsData, 'exercises'>;

export function getWorkoutSetProgress(workout: WorkoutExercises) {
  const sets = workout.exercises.flatMap((exercise) => exercise.sets);
  const completed = sets.filter((set) => set.status === 'COMPLETED').length;
  const skipped = sets.filter((set) => set.status === 'SKIPPED').length;
  const processed = completed + skipped;
  const total = sets.length;

  return {
    total,
    completed,
    skipped,
    processed,
    pending: total - processed,
    nextPendingSetId: sets.find((set) => set.status === 'PENDING')?.id ?? null,
  };
}

export function getNextPendingWorkoutSetId(workout: WorkoutExercises, currentSetId: string) {
  const sets = workout.exercises.flatMap((exercise) => exercise.sets);
  const index = sets.findIndex((set) => set.id === currentSetId);
  if (index === -1) return null;
  return sets.slice(index + 1).find((set) => set.status === 'PENDING')?.id ?? null;
}
