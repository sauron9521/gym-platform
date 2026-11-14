import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
  buildCreateExercisePayload,
  createExerciseFormSchema,
  getCreateExerciseErrorMessage,
} from '../src/features/exercises/lib/create-exercise.ts';

function validExercise() {
  return {
    name: 'Жим гантелей сидячи',
    description: '  На плечі  ',
    instructions: '  Виконувати плавно  ',
    exerciseType: 'STRENGTH',
    visibility: 'PRIVATE',
    muscleGroups: [
      { slug: 'shoulders', role: 'PRIMARY' },
      { slug: 'triceps', role: 'SECONDARY' },
    ],
    equipment: ['dumbbell', 'bench'],
  };
}

test('custom exercise schema accepts valid relation slugs from the API', () => {
  const result = createExerciseFormSchema.safeParse(validExercise());
  assert.equal(result.success, true);
  assert.deepEqual(
    result.data.muscleGroups.map((item) => item.slug),
    ['shoulders', 'triceps'],
  );
  assert.deepEqual(result.data.equipment, ['dumbbell', 'bench']);
});

test('athlete payload includes privacy and omits empty optional text', () => {
  const parsed = createExerciseFormSchema.parse({
    ...validExercise(),
    name: '  Жим гантелей  ',
    description: '',
    instructions: '  ',
    visibility: 'SELECTED_TRAINERS',
  });
  assert.deepEqual(buildCreateExercisePayload(parsed, 'ATHLETE'), {
    name: 'Жим гантелей',
    exerciseType: 'STRENGTH',
    visibility: 'SELECTED_TRAINERS',
    muscleGroups: [
      { slug: 'shoulders', role: 'PRIMARY' },
      { slug: 'triceps', role: 'SECONDARY' },
    ],
    equipment: ['dumbbell', 'bench'],
  });
});

test('trainer payload omits forbidden visibility despite form defaults', () => {
  const parsed = createExerciseFormSchema.parse(validExercise());
  const payload = buildCreateExercisePayload(parsed, 'TRAINER');
  assert.equal(Object.hasOwn(payload, 'visibility'), false);
  assert.equal(payload.description, 'На плечі');
  assert.equal(payload.instructions, 'Виконувати плавно');
});

test('schema rejects missing primary muscles and duplicate or unknown slugs', () => {
  const exercise = validExercise();
  const invalid = [
    { muscleGroups: [] },
    { muscleGroups: [{ slug: 'triceps', role: 'SECONDARY' }] },
    {
      muscleGroups: [
        { slug: 'chest', role: 'PRIMARY' },
        { slug: 'chest', role: 'SECONDARY' },
      ],
    },
    { equipment: ['dumbbell', 'dumbbell'] },
  ];
  for (const changes of invalid) {
    assert.equal(createExerciseFormSchema.safeParse({ ...exercise, ...changes }).success, false);
  }
});

test('API bounds for text, muscle groups and equipment are enforced', () => {
  const exercise = validExercise();
  for (const changes of [
    { name: 'a' },
    { name: 'a'.repeat(121) },
    { description: 'x'.repeat(5001) },
    { instructions: 'x'.repeat(10001) },
    {
      muscleGroups: Array.from({ length: 11 }, (_, i) => ({
        slug: `test-muscle-${i}`,
        role: 'PRIMARY',
      })),
    },
    { equipment: Array.from({ length: 21 }, (_, i) => `test-equipment-${i}`) },
  ]) {
    assert.equal(createExerciseFormSchema.safeParse({ ...exercise, ...changes }).success, false);
  }
});

test('new database-defined slugs are not rejected by a hardcoded frontend allowlist', () => {
  const parsed = createExerciseFormSchema.safeParse({
    ...validExercise(),
    muscleGroups: [{ slug: 'new-muscle-from-database', role: 'PRIMARY' }],
    equipment: ['new-equipment-from-database'],
  });
  assert.equal(parsed.success, true);
});

test('errors remain safe and do not expose upstream messages', () => {
  assert.equal(getCreateExerciseErrorMessage(), getCreateExerciseErrorMessage(500));
  assert.notEqual(getCreateExerciseErrorMessage(400), getCreateExerciseErrorMessage(403));
});

test('creation route checks session, role and does not render for administrators', async () => {
  const page = await readFile(
    new URL('../src/app/(protected)/exercises/new/page.tsx', import.meta.url),
    'utf8',
  );
  assert.match(page, /verifyServerSession/);
  assert.match(page, /session.kind === 'unauthenticated'/);
  assert.match(page, /session.kind === 'unavailable'/);
  assert.match(page, /session.user.role === 'ADMIN'/);
  assert.match(page, /<CreateExerciseForm/);
  assert.match(page, /robots: \{ index: false \}/);
});

test('creation uses typed POST and RHF/Zod, with state and auth handling', async () => {
  const form = await readFile(
    new URL('../src/features/exercises/ui/create-exercise-form.tsx', import.meta.url),
    'utf8',
  );
  const catalog = await readFile(
    new URL('../src/features/exercises/ui/exercise-catalog.tsx', import.meta.url),
    'utf8',
  );
  assert.match(form, /useFieldArray/);
  assert.match(form, /zodResolver\(createExerciseFormSchema\)/);
  assert.match(form, /webApi.POST\('\/exercises'/);
  assert.match(form, /response.status === 401/);
  assert.match(form, /router.replace\('\/login'\)/);
  assert.match(form, /response.status !== 201/);
  assert.match(form, /router.push/);
  assert.match(form, /role === 'ATHLETE'/);
  assert.match(form, /disabled=\{busy\}/);
  assert.match(catalog, /href="\/exercises\/new"/);
  assert.doesNotMatch(form, /localStorage|sessionStorage|dangerouslySetInnerHTML/);
});
