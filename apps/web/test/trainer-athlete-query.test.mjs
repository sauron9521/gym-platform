import assert from 'node:assert/strict';
import { test } from 'node:test';

import { trainerAthleteQueryKeys } from '../src/features/trainer-athletes/lib/trainer-athlete-query-keys.ts';

test('relationship list keys isolate actors, roles, filters and pagination', () => {
  assert.deepEqual(trainerAthleteQueryKeys.all, ['trainer-athletes']);
  assert.deepEqual(trainerAthleteQueryKeys.lists(), ['trainer-athletes', 'list']);
  assert.deepEqual(trainerAthleteQueryKeys.list('trainer-1', 'TRAINER', 'ALL', 1), [
    'trainer-athletes',
    'list',
    { actorId: 'trainer-1', actorRole: 'TRAINER', filter: 'ALL', page: 1 },
  ]);

  const base = trainerAthleteQueryKeys.list('trainer-1', 'TRAINER', 'ALL', 1);
  assert.notDeepEqual(base, trainerAthleteQueryKeys.list('trainer-2', 'TRAINER', 'ALL', 1));
  assert.notDeepEqual(base, trainerAthleteQueryKeys.list('trainer-1', 'ATHLETE', 'ALL', 1));
  assert.notDeepEqual(base, trainerAthleteQueryKeys.list('trainer-1', 'TRAINER', 'PENDING', 1));
  assert.notDeepEqual(base, trainerAthleteQueryKeys.list('trainer-1', 'TRAINER', 'ALL', 2));
});
