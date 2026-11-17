import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
test('exercise-specific progress reads typed athlete-scoped analytics and is route guarded', () => {
  const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
  const model = read('../src/features/progress/model/exercise-progress-query.ts');
  const layout = read('../src/app/_layout.tsx');
  expect(model).toContain("api.GET('/workout-analytics/exercises/{exerciseId}'");
  expect(model).toContain("enabled: account?.role === 'ATHLETE'");
  expect(layout).toContain('name="progress/exercises/[id]"');
});
