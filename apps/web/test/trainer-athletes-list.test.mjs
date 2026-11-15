import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
  formatTrainerAthleteDate,
  getTrainerAthleteContact,
  getTrainerAthleteInvitationLabel,
  getTrainerAthleteListErrorMessage,
  getTrainerAthletePageCount,
  getTrainerAthleteStatusLabel,
  searchTrainerAthletesOnPage,
  TRAINER_ATHLETE_FILTERS,
} from '../src/features/trainer-athletes/lib/trainer-athletes-list.ts';

const pending = {
  id: 'relationship-1',
  trainerId: 'trainer-1',
  athleteId: 'athlete-1',
  initiatedById: 'trainer-1',
  status: 'PENDING',
  createdAt: '2026-11-14T09:00:00Z',
  respondedAt: null,
  endedAt: null,
  athlete: { id: 'athlete-1', role: 'ATHLETE', email: 'Athlete@Example.test' },
};

const historical = {
  ...pending,
  id: 'relationship-2',
  status: 'TERMINATED',
  athlete: { id: 'athlete-2', role: 'ATHLETE' },
};

test('relationship filters include every API status', () => {
  assert.deepEqual(
    TRAINER_ATHLETE_FILTERS.map((item) => item.value),
    ['ALL', 'PENDING', 'ACTIVE', 'DECLINED', 'CANCELLED', 'TERMINATED'],
  );
  assert.equal(getTrainerAthleteStatusLabel('ACTIVE'), 'Активні');
  assert.equal(getTrainerAthleteStatusLabel('TERMINATED'), 'Завершені');
});

test('archived trainer records never expose a missing athlete email or an ID as a name', () => {
  assert.equal(getTrainerAthleteContact(pending), 'Athlete@Example.test');
  assert.equal(getTrainerAthleteContact(historical), null);
  assert.deepEqual(searchTrainerAthletesOnPage([historical], 'athlete-2'), []);
});

test('page-local email search is case insensitive and excludes redacted records', () => {
  assert.deepEqual(searchTrainerAthletesOnPage([pending, historical], ' ATHLETE@EXAMPLE '), [
    pending,
  ]);
  assert.deepEqual(searchTrainerAthletesOnPage([pending, historical], ''), [pending, historical]);
  assert.deepEqual(searchTrainerAthletesOnPage([pending, historical], 'unknown'), []);
});

test('invitation initiator label is correctly shown to the trainer', () => {
  assert.equal(getTrainerAthleteInvitationLabel(pending, 'trainer-1'), 'Запросив тренер');
  assert.equal(
    getTrainerAthleteInvitationLabel({ ...pending, initiatedById: 'athlete-1' }, 'trainer-1'),
    'Запросив атлет',
  );
});

test('pagination and date formatting work with empty and invalid metadata', () => {
  assert.equal(getTrainerAthletePageCount(0), 1);
  assert.equal(getTrainerAthletePageCount(-1), 1);
  assert.equal(getTrainerAthletePageCount(3), 3);
  assert.equal(getTrainerAthletePageCount(Number.NaN), 1);
  assert.equal(getTrainerAthletePageCount(2.5), 1);
  assert.equal(formatTrainerAthleteDate(null), 'Не вказано');
  assert.equal(formatTrainerAthleteDate('bad date'), 'Дата недоступна');
  assert.match(formatTrainerAthleteDate('2026-11-14T09:00:00Z'), /2026/);
});

test('status error messages are safe and suitable for retry', () => {
  assert.match(getTrainerAthleteListErrorMessage(403), /дозволу/);
  assert.match(getTrainerAthleteListErrorMessage(429), /Забагато/);
  assert.equal(getTrainerAthleteListErrorMessage(), getTrainerAthleteListErrorMessage(500));
});

test('protected trainer page verifies identity and role before showing private data', async () => {
  const page = await readFile(
    new URL('../src/app/(protected)/trainer/athletes/page.tsx', import.meta.url),
    'utf8',
  );
  assert.match(page, /verifyServerSession/);
  assert.match(page, /session.kind === 'unauthenticated'/);
  assert.match(page, /session.kind === 'unavailable'/);
  assert.match(page, /session.user.role !== 'TRAINER'/);
  assert.match(page, /actorId=/);
  assert.match(page, /actorRole="TRAINER"/);
  assert.match(page, /robots: \{ index: false \}/);
  assert.match(page, /force-dynamic/);
});

test('relationship UI uses cached filters, retry and 401 protection', async () => {
  const ui = await readFile(
    new URL('../src/features/trainer-athletes/ui/trainer-athletes-list.tsx', import.meta.url),
    'utf8',
  );
  const dashboard = await readFile(
    new URL('../src/widgets/dashboard/ui/dashboard-screen.tsx', import.meta.url),
    'utf8',
  );
  const api = await readFile(
    new URL('../src/features/trainer-athletes/api/trainer-athlete-list-query.ts', import.meta.url),
    'utf8',
  );
  assert.match(
    ui,
    /useQuery\(trainerAthleteListQueryOptions\(actorId, actorRole, filter, page\)\)/,
  );
  assert.match(ui, /query.refetch\(\)/);
  assert.match(ui, /queryClient.invalidateQueries/);
  assert.match(ui, /trainerAthleteQueryKeys.lists\(\)/);
  assert.match(ui, /queryClient.clear\(\)/);
  assert.match(ui, /router.replace\('\/login'\)/);
  assert.match(ui, /if \(unauthenticated\) return null/);
  assert.match(ui, /onUpdated=\{refreshRelationships\}/);
  assert.match(api, /GET\('\/trainer-athletes'/);
  assert.match(api, /filter === 'ALL'/);
  assert.match(api, /status: filter/);
  assert.match(api, /limit: PAGE_SIZE/);
  assert.match(api, /data.meta.totalPages/);
  assert.match(api, /signal,/);
  assert.match(api, /retry: false/);
  assert.match(ui, /aria-label="Сторінки підопічних"/);
  assert.match(ui, /Пошук контакту на поточній сторінці/);
  assert.match(dashboard, /initialUser.role === 'TRAINER'/);
  assert.ok(dashboard.includes("'/trainer/athletes'"));
  assert.doesNotMatch(ui, /localStorage|sessionStorage|document.cookie|dangerouslySetInnerHTML/);
});
