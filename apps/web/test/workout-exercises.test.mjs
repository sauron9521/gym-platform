import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const details = readFileSync(
  new URL('../src/features/workouts/ui/workout-details.tsx', import.meta.url),
  'utf8',
);
const exercises = readFileSync(
  new URL('../src/features/workouts/ui/workout-exercises.tsx', import.meta.url),
  'utf8',
);

const setCard = readFileSync(
  new URL('../src/features/workouts/ui/workout-set-card.tsx', import.meta.url),
  'utf8',
);

test('workout details delegates set presentation without changing query/auth boundaries', () => {
  assert.match(details, /useQuery\(workoutDetailsQueryOptions\(id\)\)/);
  assert.match(details, /useAuthFailure\(\)/);
  assert.match(details, /<WorkoutExercises/);
  assert.match(details, /onEditSet=\{setEditingSetId\}/);
  assert.match(exercises, /workout.exercises.map/);
  assert.match(exercises, /editingSetId === set.id/);
  assert.match(exercises, /<WorkoutSetCard/);
  assert.match(setCard, /<WorkoutSetForm/);
  assert.match(exercises, /editingLocked=\{editingSetId !== null\}/);
  assert.match(exercises, /workout.status === 'IN_PROGRESS'/);
  assert.match(setCard, /key=\{set.updatedAt\}/);
  assert.match(setCard, /onSaved=\{\(\) => onEditSet\(null\)\}/);
  assert.match(setCard, /onClose=\{\(\) => onEditSet\(null\)\}/);
  assert.match(setCard, /disabled=\{editingLocked\}/);
});
