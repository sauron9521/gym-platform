import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
  buildWorkoutEditPayload,
  editWorkoutSchema,
  formatLocalDateTime,
  getWorkoutEditDefaults,
  getWorkoutEditErrorMessage,
} from '../src/features/workouts/lib/edit-workout.ts';

const defaults = {
  title: 'Груди та трицепс',
  notes: 'Середня інтенсивність',
  scheduledAt: '2026-11-25T18:30',
};

test('edit schema validates title, notes and date boundaries', () => {
  assert.equal(editWorkoutSchema.safeParse(defaults).success, true);
  for (const value of ['x', ' ', 'x'.repeat(121)]) {
    assert.equal(editWorkoutSchema.safeParse({ ...defaults, title: value }).success, false);
  }
  assert.equal(
    editWorkoutSchema.safeParse({ ...defaults, notes: 'a'.repeat(5001) }).success,
    false,
  );
  for (const date of ['2026-02-31T12:00', '2026-11-25', 'not a date', '2026-12-31T25:00']) {
    assert.equal(editWorkoutSchema.safeParse({ ...defaults, scheduledAt: date }).success, false);
  }
  assert.equal(editWorkoutSchema.safeParse({ ...defaults, scheduledAt: '' }).success, true);
});

test('defaults format an ISO timestamp as local datetime input', () => {
  assert.equal(formatLocalDateTime(null), '');
  assert.equal(formatLocalDateTime('invalid'), '');
  const scheduledAt = '2026-11-25T18:30:00.000Z';
  const local = formatLocalDateTime(scheduledAt);
  assert.match(local, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  assert.equal(new Date(local).getTime(), new Date(scheduledAt).getTime());
  assert.deepEqual(getWorkoutEditDefaults({ title: 'A', notes: null, scheduledAt }), {
    title: 'A',
    notes: '',
    scheduledAt: local,
  });
});

test('editing just the title leaves existing time and notes untouched', () => {
  assert.deepEqual(buildWorkoutEditPayload({ ...defaults, title: '  Нова назва  ' }, {}), {});
  assert.deepEqual(
    buildWorkoutEditPayload({ ...defaults, title: '  Нова назва  ' }, { title: true }),
    { title: 'Нова назва' },
  );
});

test('optional fields can be cleared and local datetime serialized as ISO', () => {
  const empty = { ...defaults, notes: '', scheduledAt: '' };
  assert.deepEqual(buildWorkoutEditPayload(empty, { notes: true, scheduledAt: true }), {
    notes: null,
    scheduledAt: null,
  });
  const result = buildWorkoutEditPayload(defaults, { scheduledAt: true });
  assert.equal(result.scheduledAt, new Date(defaults.scheduledAt).toISOString());
});

test('backend errors are safe and distinguish stale status from access failures', () => {
  assert.equal(getWorkoutEditErrorMessage(400), getWorkoutEditErrorMessage(409));
  assert.equal(getWorkoutEditErrorMessage(403), getWorkoutEditErrorMessage(404));
  assert.equal(getWorkoutEditErrorMessage(), getWorkoutEditErrorMessage(500));
});

test('planned-only UI uses typed PATCH, Zod/RHF and handles unauthorized access', async () => {
  const form = await readFile(
    new URL('../src/features/workouts/ui/edit-workout-form.tsx', import.meta.url),
    'utf8',
  );
  const details = await readFile(
    new URL('../src/features/workouts/ui/workout-details.tsx', import.meta.url),
    'utf8',
  );
  assert.match(form, /zodResolver\(editWorkoutSchema\)/);
  assert.match(form, /webApi\.PATCH\('\/workouts\/\{id\}'/);
  assert.match(form, /workout.status !== 'PLANNED'/);
  assert.match(form, /response.status === 401/);
  assert.match(form, /router.replace\('\/login'\)/);
  assert.match(form, /disabled=\{isSubmitting \|\| !isDirty\}/);
  assert.match(form, /onSaved\(data\)/);
  assert.match(details, /state.workout.status === 'PLANNED'/);
  assert.match(details, /<EditWorkoutForm/);
  assert.match(details, /!editingWorkout/);
  assert.doesNotMatch(form, /localStorage|sessionStorage|dangerouslySetInnerHTML/);
});
