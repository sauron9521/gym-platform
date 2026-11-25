import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

import { strengthVolumeHeights } from '../src/features/progress/lib/chart.ts';

test('progress bars preserve zero volume and normalize positive days', () => {
  assert.deepEqual(strengthVolumeHeights([]), []);
  assert.deepEqual(strengthVolumeHeights([{ strengthVolumeKg: 0 }]), [0]);
  assert.deepEqual(
    strengthVolumeHeights([
      { strengthVolumeKg: 0 },
      { strengthVolumeKg: 100 },
      { strengthVolumeKg: 200 },
    ]),
    [0, 50, 100],
  );
});

test('progress bars handle invalid and negative API values safely', () => {
  assert.deepEqual(
    strengthVolumeHeights([
      { strengthVolumeKg: -10 },
      { strengthVolumeKg: Number.NaN },
      { strengthVolumeKg: Number.POSITIVE_INFINITY },
    ]),
    [0, 0, 0],
  );
  assert.deepEqual(
    strengthVolumeHeights([{ strengthVolumeKg: 1 }, { strengthVolumeKg: 1000 }]),
    [3, 100],
  );
});

test('athlete-only analytics query uses typed endpoint and role guard', () => {
  const code = readFileSync(
    new URL('../src/features/progress/model/workout-summary-query.ts', import.meta.url),
    'utf8',
  );
  const layout = readFileSync(new URL('../src/app/_layout.tsx', import.meta.url), 'utf8');
  const home = readFileSync(
    new URL('../src/screens/home/ui/home-screen.tsx', import.meta.url),
    'utf8',
  );

  assert.match(code, /GET\('\/workout-analytics\/summary'/);
  assert.match(code, /enabled: hasAthleteAccess\(capabilities\)/);
  assert.match(code, /response\.response\.status === 403/);
  assert.match(code, /SessionExpiredError/);
  assert.match(code, /AccessDeniedError/);
  assert.match(code, /'workout-summary', range/);
  const tabs = readFileSync(new URL('../src/app/(tabs)/_layout.tsx', import.meta.url), 'utf8');
  assert.match(tabs, /<Tabs.Protected guard=\{hasAthleteAccess\(capabilities\)\}>/);
  assert.match(tabs, /name="progress"/);
  assert.match(layout, /guard=\{hasAthleteAccess\(capabilities\)\}/);
  assert.match(home, /hasAthleteAccess\(capabilities\)/);
  assert.match(home, /router\.push\('\/progress'\)/);
});
