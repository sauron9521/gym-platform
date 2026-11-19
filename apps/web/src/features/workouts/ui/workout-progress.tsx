import type { WorkoutDetailsData } from '../lib/workout-details';
import { getWorkoutSetProgress } from '../lib/workout-set-progress';

export function WorkoutProgress({
  workout,
  editingSetId,
}: {
  workout: WorkoutDetailsData;
  editingSetId: string | null;
}) {
  const progress = getWorkoutSetProgress(workout);
  if (workout.status !== 'IN_PROGRESS' || progress.total === 0) return null;

  return (
    <div className="min-w-0 space-y-4 rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold">Прогрес тренування</h3>
        <span className="text-sm font-medium tabular-nums text-muted-foreground">
          Опрацьовано {progress.processed} із {progress.total}
        </span>
      </div>
      <progress
        aria-label="Прогрес тренування"
        value={progress.processed}
        max={progress.total}
        className="h-2 w-full accent-primary"
      />
      <dl className="grid grid-cols-3 gap-2 text-center text-xs sm:text-sm">
        <div className="rounded-lg bg-primary/10 p-2">
          <dt className="text-muted-foreground">Виконано</dt>
          <dd className="mt-1 font-semibold tabular-nums">{progress.completed}</dd>
        </div>
        <div className="rounded-lg bg-muted/60 p-2">
          <dt className="text-muted-foreground">Пропущено</dt>
          <dd className="mt-1 font-semibold tabular-nums">{progress.skipped}</dd>
        </div>
        <div className="rounded-lg bg-muted/60 p-2">
          <dt className="text-muted-foreground">Очікує</dt>
          <dd className="mt-1 font-semibold tabular-nums">{progress.pending}</dd>
        </div>
      </dl>
      {progress.nextPendingSetId && editingSetId === null && (
        <a
          href={`#workout-set-${progress.nextPendingSetId}`}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground outline-offset-2 hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-ring sm:w-auto"
        >
          До наступного підходу
        </a>
      )}
      {progress.pending === 0 && (
        <p className="text-sm text-muted-foreground">
          Усі підходи опрацьовано. Можна перейти до завершення тренування.
        </p>
      )}
    </div>
  );
}
