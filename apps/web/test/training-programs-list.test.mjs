import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
  ASSIGNMENT_STATUSES,
  formatProgramDate,
  getAssignmentStatusLabel,
  getProgramDisplayTitle,
  getProgramListError,
  getProgramPageCount,
  getProgramStatusLabel,
  getProgramVersionStatusLabel,
  PROGRAM_STATUSES,
  sortProgramVersions,
} from '../src/features/training-programs/lib/training-programs-list.ts';

const versions = [
  {
    id: 'version-1',
    version: 1,
    title: 'Перша програма',
    status: 'PUBLISHED',
    description: null,
    durationWeeks: 8,
    publishedAt: '2026-11-01T12:00:00Z',
  },
  {
    id: 'version-3',
    version: 3,
    title: 'Третя версія',
    status: 'DRAFT',
    description: null,
    durationWeeks: 12,
    publishedAt: null,
  },
];

test('program statuses match the trainer API and assignment statuses match athlete API', () => {
  assert.deepEqual(
    PROGRAM_STATUSES.map((value) => value.value),
    ['ALL', 'DRAFT', 'PUBLISHED', 'ARCHIVED'],
  );
  assert.deepEqual(
    ASSIGNMENT_STATUSES.map((value) => value.value),
    ['ALL', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'TERMINATED'],
  );
  assert.equal(getProgramStatusLabel('ARCHIVED'), 'Архівні');
  assert.equal(getAssignmentStatusLabel('COMPLETED'), 'Виконані');
  assert.equal(getProgramVersionStatusLabel('DRAFT'), 'Чернетка');
  assert.equal(getProgramVersionStatusLabel('PUBLISHED'), 'Опублікована');
});

test('program versions sort newest first without mutating the API response', () => {
  const original = [...versions];
  assert.deepEqual(
    sortProgramVersions(versions).map((version) => version.version),
    [3, 1],
  );
  assert.deepEqual(versions, original);
  assert.equal(getProgramDisplayTitle({ versions }), 'Третя версія');
  assert.equal(getProgramDisplayTitle({ versions: [] }), 'Програма без версій');
});

test('pagination and dates handle missing or malformed values safely', () => {
  assert.equal(getProgramPageCount(0), 1);
  assert.equal(getProgramPageCount(-1), 1);
  assert.equal(getProgramPageCount(2.5), 1);
  assert.equal(getProgramPageCount(Number.NaN), 1);
  assert.equal(getProgramPageCount(5), 5);
  assert.equal(formatProgramDate(null), 'Не вказано');
  assert.equal(formatProgramDate('not-a-date'), 'Дата недоступна');
  assert.match(formatProgramDate('2026-11-14T10:00:00Z'), /2026/);
});

test('program list errors are friendly and do not expose backend content', () => {
  assert.equal(getProgramListError(), getProgramListError(500));
  assert.equal(getProgramListError(403), getProgramListError(404));
  assert.notEqual(getProgramListError(429), getProgramListError(400));
});

test('role-specific program pages independently verify sessions', async () => {
  for (const [path, expectedRole] of [
    ['../src/app/(protected)/trainer/programs/page.tsx', 'TRAINER'],
    ['../src/app/(protected)/athlete/programs/page.tsx', 'ATHLETE'],
  ]) {
    const page = await readFile(new URL(path, import.meta.url), 'utf8');
    assert.match(page, /verifyServerSession/);
    assert.match(page, /session.kind === 'unauthenticated'/);
    assert.match(page, /session.kind === 'unavailable'/);
    assert.ok(page.includes(`session.user.role !== '${expectedRole}'`));
    assert.match(page, /robots: \{ index: false \}/);
    assert.match(page, /force-dynamic/);
  }
});

test('trainer journal uses only owner-scoped API with version summaries', async () => {
  const trainer = await readFile(
    new URL('../src/features/training-programs/ui/trainer-programs-list.tsx', import.meta.url),
    'utf8',
  );
  assert.match(trainer, /GET\('\/training-programs'/);
  assert.match(trainer, /status === 'ALL'/);
  assert.match(trainer, /limit: PAGE_SIZE/);
  assert.match(trainer, /data.meta.totalPages/);
  assert.match(trainer, /sortProgramVersions/);
  assert.match(trainer, /getProgramVersionStatusLabel/);
  assert.match(trainer, /response.status === 401/);
  assert.match(trainer, /if \(!active\) return/);
  assert.match(trainer, /active = false/);
  assert.match(trainer, /onClick=\{retry\}/);
  assert.doesNotMatch(trainer, /localStorage|sessionStorage|dangerouslySetInnerHTML/);
});

test('athlete journal uses assignment summary view, not the trainer program library', async () => {
  const athlete = await readFile(
    new URL('../src/features/training-programs/ui/athlete-programs-list.tsx', import.meta.url),
    'utf8',
  );
  const dashboard = await readFile(
    new URL('../src/widgets/dashboard/ui/dashboard-screen.tsx', import.meta.url),
    'utf8',
  );
  assert.match(athlete, /GET\('\/training-programs\/assignments'/);
  assert.match(athlete, /view: 'summary'/);
  assert.match(athlete, /status === 'ALL'/);
  assert.match(athlete, /assignment.version.title/);
  assert.match(athlete, /response.status === 401/);
  assert.match(athlete, /router.replace\('\/login'\)/);
  assert.match(athlete, /active = false/);
  assert.doesNotMatch(athlete, /GET\('\/training-programs'/);
  assert.doesNotMatch(athlete, /assignedBy.email|athlete.email/);
  assert.ok(dashboard.includes("'/trainer/programs'"));
  assert.ok(dashboard.includes("'/athlete/programs'"));
});
