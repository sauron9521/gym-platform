import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
  endRelationshipSchema,
  getAvailableRelationshipActions,
  getRelationshipMutationError,
  invitationSchema,
} from '../src/features/trainer-athletes/lib/trainer-athlete-actions.ts';
import {
  getRelationshipContact,
  searchTrainerAthletesOnPage,
} from '../src/features/trainer-athletes/lib/trainer-athletes-list.ts';

const participant = {
  id: 'relationship-1',
  trainerId: 'trainer-1',
  athleteId: 'athlete-1',
  initiatedById: 'trainer-1',
  status: 'PENDING',
  trainer: { id: 'trainer-1', email: 'coach@example.test', role: 'TRAINER' },
  athlete: { id: 'athlete-1', email: 'athlete@example.test', role: 'ATHLETE' },
};

test('invitation requires a valid UUID and accepts a target user ID', () => {
  assert.equal(invitationSchema.safeParse({ userId: 'invalid' }).success, false);
  assert.equal(invitationSchema.safeParse({ userId: '' }).success, false);
  assert.equal(
    invitationSchema.safeParse({ userId: '11111111-1111-4111-8111-111111111111' }).success,
    true,
  );
});

test('relationship termination reason is optional and limited to 500 characters', () => {
  assert.equal(endRelationshipSchema.safeParse({ reason: '' }).success, true);
  assert.equal(endRelationshipSchema.safeParse({ reason: '  Добровільно  ' }).success, true);
  assert.equal(endRelationshipSchema.parse({ reason: '  Добровільно  ' }).reason, 'Добровільно');
  assert.equal(endRelationshipSchema.safeParse({ reason: 'x'.repeat(501) }).success, false);
});

test('only pending recipients can accept or decline, and only initiators can cancel', () => {
  assert.deepEqual(getAvailableRelationshipActions(participant, 'trainer-1'), ['cancel']);
  assert.deepEqual(getAvailableRelationshipActions(participant, 'unrelated-user'), []);
  assert.deepEqual(getAvailableRelationshipActions(participant, 'athlete-1'), [
    'accept',
    'decline',
  ]);
  assert.deepEqual(
    getAvailableRelationshipActions({ ...participant, initiatedById: 'athlete-1' }, 'trainer-1'),
    ['accept', 'decline'],
  );
});

test('active relationships can be terminated, and historical records cannot be mutated', () => {
  assert.deepEqual(
    getAvailableRelationshipActions({ ...participant, status: 'ACTIVE' }, 'trainer-1'),
    ['terminate'],
  );
  for (const status of ['DECLINED', 'CANCELLED', 'TERMINATED']) {
    assert.deepEqual(getAvailableRelationshipActions({ ...participant, status }, 'trainer-1'), []);
  }
});

test('error messages do not leak upstream responses and expose stale state', () => {
  assert.notEqual(getRelationshipMutationError(409), getRelationshipMutationError(403));
  assert.equal(getRelationshipMutationError(500), getRelationshipMutationError());
  assert.match(getRelationshipMutationError(429), /Забагато/);
});

test('contact selection respects trainer history redaction and athlete viewpoint', () => {
  const redacted = {
    ...participant,
    status: 'TERMINATED',
    athlete: { id: 'athlete-1', role: 'ATHLETE' },
    trainer: { id: 'trainer-1', role: 'TRAINER' },
  };
  assert.equal(getRelationshipContact(participant, 'TRAINER'), 'athlete@example.test');
  assert.equal(getRelationshipContact(participant, 'ATHLETE'), 'coach@example.test');
  assert.equal(getRelationshipContact(redacted, 'TRAINER'), null);
  assert.equal(getRelationshipContact(redacted, 'ATHLETE'), null);
  assert.deepEqual(searchTrainerAthletesOnPage([participant], 'coach@', 'ATHLETE'), [participant]);
  assert.deepEqual(searchTrainerAthletesOnPage([redacted], 'athlete', 'TRAINER'), []);
});

test('athlete page has an independent authenticated session and role guard', async () => {
  const page = await readFile(
    new URL('../src/app/(protected)/athlete/trainers/page.tsx', import.meta.url),
    'utf8',
  );
  assert.match(page, /verifyServerSession/);
  assert.match(page, /session.kind === 'unauthenticated'/);
  assert.match(page, /session.kind === 'unavailable'/);
  assert.match(page, /session.user.role !== 'ATHLETE'/);
  assert.match(page, /actorRole="ATHLETE"/);
  assert.match(page, /robots: \{ index: false \}/);
});

test('mutation UI calls all typed routes and keeps destructive actions confirmed', async () => {
  const invite = await readFile(
    new URL('../src/features/trainer-athletes/ui/invite-relationship-form.tsx', import.meta.url),
    'utf8',
  );
  const actions = await readFile(
    new URL('../src/features/trainer-athletes/ui/relationship-actions.tsx', import.meta.url),
    'utf8',
  );
  const list = await readFile(
    new URL('../src/features/trainer-athletes/ui/trainer-athletes-list.tsx', import.meta.url),
    'utf8',
  );
  assert.match(invite, /zodResolver\(invitationSchema\)/);
  assert.match(invite, /webApi.POST\('\/trainer-athletes'/);
  assert.match(invite, /values.userId === actorId/);
  assert.doesNotMatch(invite, /if \(form\.formState\.isSubmitting\) return;/);
  assert.match(invite, /response.status === 401/);
  assert.match(invite, /response.status !== 201/);
  assert.match(actions, /getAvailableRelationshipActions/);
  assert.match(actions, /zodResolver\(endRelationshipSchema\)/);
  for (const action of ['accept', 'decline', 'cancel', 'terminate']) {
    assert.ok(actions.includes(`'/trainer-athletes/{id}/${action}'`));
  }
  assert.match(actions, /onSubmit=\{form.handleSubmit\(confirm\)\}/);
  assert.match(actions, /setSelected\(action\)/);
  assert.match(actions, /Сервер зберігає необхідні копії/);
  assert.match(actions, /response.status === 401/);
  assert.match(list, /<InviteRelationshipForm/);
  assert.match(list, /<RelationshipActions/);
  assert.doesNotMatch(actions + invite, /localStorage|sessionStorage|dangerouslySetInnerHTML/);
});
