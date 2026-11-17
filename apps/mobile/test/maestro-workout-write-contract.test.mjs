import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('Maestro write journey stays opt-in, approved and bound to the staging package', () => {
  const workflow = read('../../../.github/workflows/mobile-native-e2e.yml');
  const flow = read('../maestro/flows/workout-write-smoke.yaml');
  expect(workflow).toContain('workflow_dispatch:');
  expect(workflow).toContain('environment: mobile-staging');
  expect(workflow).toContain('workout-write) FLOW_FILE=workout-write-smoke.yaml');
  expect(workflow).toContain('MOBILE_STAGING_ANDROID_APP_ID');
  expect(workflow).toContain('MOBILE_E2E_EXERCISE_NAME');
  expect(workflow).toContain('"$APP_ID" != "$EXPECTED_STAGING_APP_ID"');
  expect(flow).toContain('E2E_WORKOUT_TITLE');
  expect(flow).toContain('workout-status-action');
  expect(flow).toContain('create-workout-submit');
});

test('write flow selectors track the actual multi-exercise workout UI', () => {
  const flow = read('../maestro/flows/workout-write-smoke.yaml');
  const tabs = read('../src/app/(tabs)/_layout.tsx');
  const workouts = read('../src/screens/workouts/ui/workouts-screen.tsx');
  const create = read('../src/screens/workouts/ui/create-workout-screen.tsx');
  const picker = read('../src/features/exercises/ui/exercise-picker.tsx');
  const details = read('../src/screens/workouts/ui/workout-details-screen.tsx');
  const sets = read('../src/screens/workouts/ui/workout-set-row.tsx');
  expect(tabs).toContain("tabBarButtonTestID: 'mobile-tab-workouts'");
  expect(flow).toContain('id: mobile-tab-workouts');
  expect(workouts).toContain('testID="workouts-create"');
  expect(create).toContain('testID="create-workout-submit"');
  expect(picker).toContain('testID="workout-exercise-search"');
  expect(details).toContain('testID="workout-status-action"');
  expect(sets).toContain('Повторення, підхід ${set.setNumber}');
  expect(sets).toContain('Вага, підхід ${set.setNumber}');
  expect(flow).toContain('eraseText: 20');
  expect(flow).toContain('assertVisible: Підхід 1 · Виконано');
});
