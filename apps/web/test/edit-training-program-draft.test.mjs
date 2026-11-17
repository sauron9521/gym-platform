import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'vitest';

import { createTrainingProgramFormSchema } from '../src/features/training-programs/lib/create-training-program.ts';
import {
  buildUpdateTrainingProgramDraftPayload,
  getTrainingProgramDetailsError,
  getUpdateTrainingProgramDraftError,
  toTrainingProgramDraftValues,
} from '../src/features/training-programs/lib/edit-training-program-draft.ts';

const editTrainingProgramDraftSchema = createTrainingProgramFormSchema;

const version = {
  title: 'Тренування для сили',
  description: 'Основна програма',
  durationWeeks: 8,
};

test('draft editor reuses API-aligned create validation', () => {
  const valid = toTrainingProgramDraftValues(version);
  assert.deepEqual(valid, {
    title: version.title,
    description: version.description,
    durationWeeks: '8',
  });
  assert.equal(editTrainingProgramDraftSchema.safeParse(valid).success, true);

  for (const durationWeeks of ['0', '53', '1.5', '-1', 'abc']) {
    assert.equal(
      editTrainingProgramDraftSchema.safeParse({
        ...valid,
        durationWeeks,
      }).success,
      false,
    );
  }
  assert.equal(editTrainingProgramDraftSchema.safeParse({ ...valid, title: ' ' }).success, false);
});

test('draft PATCH payload trims title and explicitly clears optional values', () => {
  assert.deepEqual(
    buildUpdateTrainingProgramDraftPayload(
      editTrainingProgramDraftSchema.parse({
        title: '  Нова назва  ',
        description: '   ',
        durationWeeks: '  ',
      }),
    ),
    { title: 'Нова назва', description: null, durationWeeks: null },
  );
  assert.deepEqual(
    buildUpdateTrainingProgramDraftPayload(
      editTrainingProgramDraftSchema.parse({
        title: ' Назва ',
        description: '  Деталі  ',
        durationWeeks: '12',
      }),
    ),
    { title: 'Назва', description: 'Деталі', durationWeeks: 12 },
  );
  assert.deepEqual(
    toTrainingProgramDraftValues({ title: 'Без терміну', description: null, durationWeeks: null }),
    { title: 'Без терміну', description: '', durationWeeks: '' },
  );
});

test('details and PATCH errors preserve ownership/privacy and concurrency semantics', () => {
  assert.equal(getTrainingProgramDetailsError(403), getTrainingProgramDetailsError(404));
  assert.notEqual(getTrainingProgramDetailsError(429), getTrainingProgramDetailsError());
  assert.equal(getUpdateTrainingProgramDraftError(403), getUpdateTrainingProgramDraftError(404));
  assert.notEqual(getUpdateTrainingProgramDraftError(409), getUpdateTrainingProgramDraftError(400));
  assert.equal(getUpdateTrainingProgramDraftError(), getUpdateTrainingProgramDraftError(500));
});

test('trainer detail route verifies its own session and protects invalid IDs', async () => {
  const page = await readFile(
    new URL('../src/app/(protected)/trainer/programs/[programId]/page.tsx', import.meta.url),
    'utf8',
  );
  assert.match(page, /verifyServerSession/);
  assert.match(page, /session.kind === 'unauthenticated'/);
  assert.match(page, /session.kind === 'unavailable'/);
  assert.match(page, /session.user.role !== 'TRAINER'/);
  assert.match(page, /z.uuid\(\).safeParse\(programId\)/);
  assert.match(page, /robots: \{ index: false \}/);
  assert.match(page, /force-dynamic/);
});

test('program detail/editor use typed paths and allow only active draft updates', async () => {
  const root = '../src/features/training-programs/ui/';
  const details = await readFile(
    new URL(root + 'trainer-program-details.tsx', import.meta.url),
    'utf8',
  );
  const editor = await readFile(
    new URL(root + 'edit-training-program-draft-form.tsx', import.meta.url),
    'utf8',
  );
  const list = await readFile(new URL(root + 'trainer-programs-list.tsx', import.meta.url), 'utf8');
  const mutations = await readFile(
    new URL('../src/features/training-programs/api/training-program-mutations.ts', import.meta.url),
    'utf8',
  );

  const query = await readFile(
    new URL(
      '../src/features/training-programs/api/trainer-program-details-query.ts',
      import.meta.url,
    ),
    'utf8',
  );
  assert.match(details, /useQuery\(trainerProgramDetailsQueryOptions\(programId\)\)/);
  assert.match(details, /latest\?\.status === 'DRAFT' && program.status !== 'ARCHIVED'/);
  assert.match(details, /queryClient.clear\(\)/);
  assert.match(mutations, /queryClient.setQueryData/);
  assert.match(mutations, /useAuthFailure\(\)/);
  assert.match(details, /router.replace\('\/login'\)/);
  assert.match(details, /if \(unauthenticated\) return null/);
  assert.match(details, /query.refetch\(\)/);
  assert.match(query, /GET\('\/training-programs\/\{programId\}'/);
  assert.match(query, /signal,/);
  assert.match(query, /response.status !== 200/);
  assert.match(query, /getTrainingProgramDetailsError/);
  assert.match(query, /retry: false/);
  assert.match(editor, /zodResolver\(createTrainingProgramFormSchema\)/);
  assert.match(editor, /useUpdateTrainingProgramDraftMutation\(programId, version.id\)/);
  assert.match(editor, /mutation.mutateAsync\(values\)/);
  assert.match(editor, /mutation.isPending/);
  assert.match(editor, /mutation.isError/);
  assert.match(editor, /form.reset/);
  assert.match(mutations, /PATCH\(/);
  assert.match(mutations, /'\/training-programs\/\{programId\}\/versions\/\{versionId\}'/);
  assert.match(mutations, /response.status !== 200/);
  assert.match(mutations, /getUpdateTrainingProgramDraftError/);
  assert.match(mutations, /trainingProgramQueryKeys.detail\(programId\)/);
  assert.match(mutations, /trainingProgramQueryKeys.lists\(\)/);
  assert.match(mutations, /trainingProgramQueryKeys.version\(programId, versionId\)/);
  assert.doesNotMatch(editor, /webApi.PATCH/);
  assert.ok(list.includes("t('details')"), 'Details link remains translated');
  for (const file of [details, editor, query, mutations]) {
    assert.doesNotMatch(file, /localStorage|sessionStorage|dangerouslySetInnerHTML/);
  }
});
