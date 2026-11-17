import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';

test('exercise analytics use a typed account-scoped endpoint guarded by ATHLETE navigation', () => {
  const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
  const model = read('../src/features/progress/model/exercise-progress-query.ts');
  const layout = read('../src/app/_layout.tsx');
  expect(model).toContain("api.GET('/workout-analytics/exercises/{exerciseId}'");
  expect(model).toContain("enabled: account?.role === 'ATHLETE'");
  expect(model).toContain("'exercise-progress'");
  expect(layout).toContain('name="progress/exercises/[id]"');
});
