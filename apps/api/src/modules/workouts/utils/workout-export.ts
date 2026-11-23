import type { Prisma } from '#prisma/client';
import type { WorkoutExportQuery } from '../dto/workout.schemas.js';
import type { workoutExportSelect } from '../selects/workout.select.js';

type ExportWorkout = Prisma.WorkoutGetPayload<{ select: typeof workoutExportSelect }>;

const exportCopy = {
  uk: {
    workout: 'Тренування',
    completed: 'Завершено (UTC)',
    reps: 'повт.',
    weight: 'кг',
    duration: 'с',
    distance: 'м',
    noMetrics: 'Без записаних показників',
  },
  en: {
    workout: 'Workout',
    completed: 'Completed (UTC)',
    reps: 'reps',
    weight: 'kg',
    duration: 's',
    distance: 'm',
    noMetrics: 'No recorded metrics',
  },
};

export function buildWorkoutExport(
  record: ExportWorkout & { completedAt: Date },
  locale: WorkoutExportQuery['locale'],
) {
  const workout = {
    title: record.title,
    completedAt: record.completedAt.toISOString(),
    exercises: record.exercises.map(({ exerciseNameSnapshot, sets }) => ({
      name: exerciseNameSnapshot,
      sets: sets.map((set) => ({
        setNumber: set.setNumber,
        actualReps: set.actualReps,
        actualWeightKg: set.actualWeightKg?.toString() ?? null,
        actualDurationSeconds: set.actualDurationSeconds,
        actualDistanceMeters: set.actualDistanceMeters?.toString() ?? null,
        rpe: set.rpe?.toString() ?? null,
        rir: set.rir,
      })),
    })),
  };

  const copy = exportCopy[locale];
  const text = [
    `${copy.workout}: ${workout.title}`,
    `${copy.completed}: ${workout.completedAt}`,
    ...workout.exercises.flatMap(({ name, sets }) => [
      '',
      name,
      ...sets.map((set) => {
        const metrics = [
          [set.actualReps, copy.reps],
          [set.actualWeightKg, copy.weight],
          [set.actualDurationSeconds, copy.duration],
          [set.actualDistanceMeters, copy.distance],
          [set.rpe, 'RPE'],
          [set.rir, 'RIR'],
        ]
          .filter(([value]) => value !== null)
          .map(([value, unit]) => `${value} ${unit}`)
          .join(' · ');
        return `${set.setNumber}. ${metrics || copy.noMetrics}`;
      }),
    ]),
  ].join('\n');

  return { schemaVersion: 1 as const, workout, text };
}
