import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'vitest';

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

test('trainer journal uses TanStack Query and preserves the owner-scoped API', async () => {
  const trainer = await readFile(
    new URL('../src/features/training-programs/ui/trainer-programs-list.tsx', import.meta.url),
    'utf8',
  );
  const request = await readFile(
    new URL(
      '../src/features/training-programs/api/trainer-programs-list-query.ts',
      import.meta.url,
    ),
    'utf8',
  );
  assert.match(trainer, /useQuery\(trainerProgramsListQueryOptions\(status, page\)\)/);
  assert.match(trainer, /query.refetch\(\)/);
  assert.match(trainer, /sortProgramVersions/);
  assert.match(trainer, /getProgramVersionStatusLabel/);
  assert.match(trainer, /queryClient.clear\(\)/);
  assert.match(trainer, /router.replace\('\/login'\)/);
  assert.match(trainer, /if \(unauthenticated\) return null/);
  assert.match(trainer, /onClick=\{retry\}/);

  assert.match(request, /GET\('\/training-programs'/);
  assert.match(request, /status === 'ALL'/);
  assert.match(request, /limit: PAGE_SIZE/);
  assert.match(request, /data.meta.totalPages/);
  assert.match(request, /signal,/);
  assert.match(request, /retry: false/);
  assert.doesNotMatch(trainer + request, /localStorage|sessionStorage|dangerouslySetInnerHTML/);
});

test('athlete journal uses a privacy-safe TanStack Query assignment summary', async () => {
  const athlete = await readFile(
    new URL('../src/features/training-programs/ui/athlete-programs-list.tsx', import.meta.url),
    'utf8',
  );
  const api = await readFile(
    new URL(
      '../src/features/training-programs/api/athlete-assignments-list-query.ts',
      import.meta.url,
    ),
    'utf8',
  );
  const dashboard = await readFile(
    new URL('../src/widgets/dashboard/ui/dashboard-home.tsx', import.meta.url),
    'utf8',
  );

  assert.match(athlete, /useQuery\(athleteAssignmentsListQueryOptions\(status, page\)\)/);
  assert.match(athlete, /query.refetch\(\)/);
  assert.match(athlete, /assignment.version.title/);
  assert.match(athlete, /queryClient.clear\(\)/);
  assert.match(athlete, /router.replace\('\/login'\)/);
  assert.match(athlete, /if \(unauthenticated\) return null/);
  assert.doesNotMatch(athlete, /localStorage|sessionStorage|dangerouslySetInnerHTML/);

  assert.match(api, /GET\('\/training-programs\/assignments'/);
  assert.match(api, /view: 'summary'/);
  assert.match(api, /status === 'ALL'/);
  assert.match(api, /limit: PAGE_SIZE/);
  assert.match(api, /data.meta.totalPages/);
  assert.match(api, /signal,/);
  assert.match(api, /retry: false/);
  assert.doesNotMatch(api, /GET\('\/training-programs'/);
  assert.doesNotMatch(athlete + api, /assignedBy.email|athlete.email/);
  assert.ok(dashboard.includes("'/trainer/programs'"));
  assert.ok(dashboard.includes("'/athlete/programs'"));
});
