import { readFileSync } from 'node:fs';
import { test, expect } from 'vitest';
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('the optional mutating native smoke is manual and staging-only', () => {
  const workflow = read('../../../.github/workflows/mobile-native-e2e.yml');
  const flow = read('../maestro/flows/workout-write-smoke.yaml');
  expect(workflow).toContain('workflow_dispatch:');
  expect(workflow).toContain('workout-write) FLOW_FILE=workout-write-smoke.yaml');
  expect(workflow).toContain('MOBILE_E2E_EXERCISE_NAME');
  expect(workflow).toContain('mobile-staging');
  expect(flow).toContain('workout-status-action');
  expect(flow).toContain('create-workout-submit');
});
