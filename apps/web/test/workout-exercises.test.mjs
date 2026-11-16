import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const details = readFileSync(
  new URL('../src/features/workouts/ui/workout-details.tsx', import.meta.url),
  'utf8',
);
const exercises = readFileSync(
  new URL('../src/features/workouts/ui/workout-exercises.tsx', import.meta.url),
  'utf8',
);

test('workout details delegates set presentation without changing query/auth boundaries', () => {
  assert.match(details, /useQuery\(workoutDetailsQueryOptions\(id\)\)/);
  assert.match(details, /useAuthFailure\(\)/);
  assert.match(details, /<WorkoutExercises/);
  assert.match(details, /onEditSet=\{setEditingSetId\}/);
  assert.match(exercises, /workout.exercises.map/);
  assert.match(exercises, /editingSetId === set.id/);
  assert.match(exercises, /<WorkoutSetForm/);
  assert.match(exercises, /workout.status === 'IN_PROGRESS'/);
  assert.match(exercises, /key=\{set.updatedAt\}/);
  assert.match(exercises, /onSaved=\{\(\) => onEditSet\(null\)\}/);
  assert.match(exercises, /onClose=\{\(\) => onEditSet\(null\)\}/);
});
