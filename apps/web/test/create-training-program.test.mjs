import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
  buildCreateTrainingProgramPayload,
  createTrainingProgramFormSchema,
  getCreateTrainingProgramErrorMessage,
} from '../src/features/training-programs/lib/create-training-program.ts';

const valid = { title: '  Моя програма  ', description: '  Сила  ', durationWeeks: '8' };

test('draft program form validates title and optional duration like the API', () => {
  assert.equal(createTrainingProgramFormSchema.safeParse(valid).success, true);
  assert.equal(
    createTrainingProgramFormSchema.safeParse({
      title: '  ',
      description: '',
      durationWeeks: '',
    }).success,
    false,
  );

  for (const durationWeeks of ['0', '53', '-1', '1.5', 'abc', '1e1', '01']) {
    assert.equal(
      createTrainingProgramFormSchema.safeParse({
        title: 'Тренувальна програма',
        description: '',
        durationWeeks,
      }).success,
      durationWeeks === '01',
    );
  }

  assert.equal(
    createTrainingProgramFormSchema.safeParse({
      title: 'Назва',
      description: 'a'.repeat(5001),
      durationWeeks: '',
    }).success,
    false,
  );
  assert.equal(
    createTrainingProgramFormSchema.safeParse({
      title: 'Назва',
      description: '',
      durationWeeks: '52',
    }).success,
    true,
  );
});

test('typed create payload trims fields and omits empty optional properties', () => {
  const values = createTrainingProgramFormSchema.parse(valid);
  assert.deepEqual(buildCreateTrainingProgramPayload(values), {
    title: 'Моя програма',
    description: 'Сила',
    durationWeeks: 8,
  });
  assert.deepEqual(
    buildCreateTrainingProgramPayload(
      createTrainingProgramFormSchema.parse({
        title: '  Нова програма  ',
        description: '   ',
        durationWeeks: '   ',
      }),
    ),
    { title: 'Нова програма' },
  );
});

test('creation errors are status-derived without exposing API response content', () => {
  const error = getCreateTrainingProgramErrorMessage;
  assert.notEqual(error(400), error(403));
  assert.notEqual(error(429), error(500));
  assert.equal(error(), error(500));
});

test('new program page protects trainer role and creation calls the same-origin API', async () => {
  const page = await readFile(
    new URL('../src/app/(protected)/trainer/programs/new/page.tsx', import.meta.url),
    'utf8',
  );
  const featureRoot = '../src/features/training-programs/';
  const form = await readFile(
    new URL(featureRoot + 'ui/create-training-program-form.tsx', import.meta.url),
    'utf8',
  );
  const list = await readFile(
    new URL(featureRoot + 'ui/trainer-programs-list.tsx', import.meta.url),
    'utf8',
  );
  const mutations = await readFile(
    new URL(featureRoot + 'api/training-program-mutations.ts', import.meta.url),
    'utf8',
  );

  assert.match(page, /verifyServerSession/);
  assert.match(page, /session.user.role !== 'TRAINER'/);
  assert.match(page, /session.kind === 'unauthenticated'/);
  assert.match(page, /session.kind === 'unavailable'/);
  assert.match(page, /robots: \{ index: false \}/);
  assert.match(page, /force-dynamic/);
  assert.match(form, /zodResolver\(createTrainingProgramFormSchema\)/);
  assert.match(form, /useCreateTrainingProgramMutation\(\)/);
  assert.match(form, /mutation.mutateAsync\(values\)/);
  assert.match(form, /mutation.isPending/);
  assert.match(form, /mutation.isError/);
  assert.match(mutations, /POST\('\/training-programs'/);
  assert.match(mutations, /response.status !== 201/);
  assert.match(mutations, /trainingProgramQueryKeys.lists\(\)/);
  assert.match(mutations, /useAuthFailure\(\)/);
  assert.match(mutations, /retry: false/);
  assert.doesNotMatch(form, /webApi.POST|setError|setSubmitting/);
  assert.match(form, /router.push\('\/trainer\/programs'\)/);
  assert.ok(list.includes('href="/trainer/programs/new"'));
  assert.doesNotMatch(form, /localStorage|sessionStorage|dangerouslySetInnerHTML/);
});
