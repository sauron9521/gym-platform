import assert from 'node:assert/strict';
import { test } from 'vitest';

import { strengthVolumeHeights } from '../src/features/progress/lib/chart.ts';

test('progress chart stays safe for empty data and normalizes relative volume', () => {
  assert.deepEqual(strengthVolumeHeights([]), []);
  assert.deepEqual(strengthVolumeHeights([{ strengthVolumeKg: 0 }]), [3]);
  assert.deepEqual(
    strengthVolumeHeights([{ strengthVolumeKg: 100 }, { strengthVolumeKg: 200 }]),
    [50, 100],
  );
});
