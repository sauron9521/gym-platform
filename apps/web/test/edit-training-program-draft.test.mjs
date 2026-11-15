import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
  buildUpdateTrainingProgramDraftPayload,
  editTrainingProgramDraftSchema,
  getTrainingProgramDetailsError,
  getUpdateTrainingProgramDraftError,
  toTrainingProgramDraftValues,
} from '../src/features/training-programs/lib/edit-training-program-draft.ts';

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

  assert.match(details, /GET\('\/training-programs\/\{programId\}'/);
  assert.match(details, /latest\?\.status === 'DRAFT' && program.status !== 'ARCHIVED'/);
  assert.match(details, /response.status === 401/);
  assert.match(details, /active = false/);
  assert.match(editor, /zodResolver\(editTrainingProgramDraftSchema\)/);
  assert.match(editor, /PATCH\(/);
  assert.match(editor, /'\/training-programs\/\{programId\}\/versions\/\{versionId\}'/);
  assert.match(editor, /response.status === 401/);
  assert.match(editor, /response.status !== 200/);
  assert.match(editor, /form.reset/);
  assert.match(list, /Деталі програми/);
  for (const file of [details, editor]) {
    assert.doesNotMatch(file, /localStorage|sessionStorage|dangerouslySetInnerHTML/);
  }
});
