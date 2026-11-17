import { readFileSync } from 'node:fs';
import { test, expect } from 'vitest';
const model = readFileSync(new URL('../src/features/workouts/model/workout-edit.ts', import.meta.url), 'utf8');
const screen = readFileSync(new URL('../src/screens/workouts/ui/workout-details-screen.tsx', import.meta.url), 'utf8');
test('workout editing uses the typed PATCH/cancel endpoints with no automatic retry', () => {
  expect(model).toContain("api.PATCH('/workouts/{id}'");
  expect(model).toContain("api.POST('/workouts/{id}/cancel'");
  expect(model).toContain("networkMode: 'always'");
  expect(model).toContain('retry: false');
  expect(screen).toContain('confirmCancel');
});
