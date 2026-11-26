import assert from 'node:assert/strict';
import { test } from 'node:test';

import { defaultWorkoutPreferences, isRestDuration, restDurationPresets } from '../src/index.js';

test('workout preference defaults match the existing mobile behavior', () => {
  assert.deepEqual(defaultWorkoutPreferences, { autoRestTimer: true, restDurationSeconds: 90 });
  assert.deepEqual(restDurationPresets, [60, 90, 120]);
  assert.ok(isRestDuration(defaultWorkoutPreferences.restDurationSeconds));
  assert.ok(Object.isFrozen(defaultWorkoutPreferences));
  assert.ok(Object.isFrozen(restDurationPresets));
});

test('rest duration accepts only numeric supported presets', () => {
  for (const seconds of restDurationPresets) assert.ok(isRestDuration(seconds));
  for (const invalid of [0, 59, 61, 150, 90.5, '90', NaN, Infinity, null, undefined, {}, true])
    assert.equal(isRestDuration(invalid), false);
});
