import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

import { nextExercisePage } from '../src/features/exercises/lib/exercises-pagination.ts';

test('exercise catalog page navigation stops at last or invalid page', () => {
  assert.equal(nextExercisePage(5, 1), 2);
  assert.equal(nextExercisePage(5, 5), undefined);
  assert.equal(nextExercisePage(0, 1), undefined);
  assert.equal(nextExercisePage(5.5, 2), undefined);
  assert.equal(nextExercisePage(5, 0), undefined);
  assert.equal(nextExercisePage(Number.NaN, 1), undefined);
});

test('typed exercise queries scope filters, page sizes and 401 handling', () => {
  const code = readFileSync(
    new URL('../src/features/exercises/model/exercises-query.ts', import.meta.url),
    'utf8',
  );
  assert.match(code, /GET\('\/exercises'/);
  assert.match(code, /GET\('\/exercises\/muscle-groups'/);
  assert.match(code, /GET\('\/exercises\/equipment'/);
  assert.match(code, /useInfiniteQuery/);
  assert.match(code, /nextExercisePage/);
  assert.match(code, /limit: 20/);
  assert.match(code, /status === 401/g);
  assert.match(code, /SessionExpiredError/);
  assert.match(code, /retry: \(count, error\)/);
});

test('catalog offers search debounce, manual page retry and home navigation', () => {
  const screen = readFileSync(
    new URL('../src/screens/exercises/ui/exercises-screen.tsx', import.meta.url),
    'utf8',
  );
  const home = readFileSync(new URL('../src/screens/home/ui/home-screen.tsx', import.meta.url), 'utf8');
  const layout = readFileSync(new URL('../src/app/_layout.tsx', import.meta.url), 'utf8');
  assert.match(screen, /setTimeout\(\(\) => setDebouncedSearch/);
  assert.match(screen, /isFetchNextPageError/);
  assert.match(screen, /!query\.isFetching && !query\.isFetchNextPageError/);
  assert.match(screen, /exercises-load-more/);
  assert.match(home, /router\.push\('\/exercises'\)/);
  assert.match(layout, /name="exercises\/index"/);
  assert.match(layout, /name="programs\/\[id\]"/);
  assert.match(layout, /name="workouts\/new"/);
});
