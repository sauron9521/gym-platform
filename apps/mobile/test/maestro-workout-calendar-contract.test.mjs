import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const workflow = read('../../../.github/workflows/mobile-native-e2e.yml');
const flow = read('../maestro/flows/workout-calendar-smoke.yaml');
const screen = read('../src/screens/workouts/ui/workout-calendar-screen.tsx');

test('calendar smoke is guarded staging-only and checks both calendar modes with a seeded fixture', () => {
  const guard = workflow.indexOf('"$FLOW" == "calendar-read"');
  const download = workflow.indexOf('curl --fail --location');
  expect(guard).toBeGreaterThan(-1);
  expect(download).toBeGreaterThan(guard);
  expect(workflow.slice(guard, download)).toContain('"$APP_ID" != "$EXPECTED_STAGING_APP_ID"');
  expect(workflow).toContain('environment: mobile-staging');
  expect(workflow).toContain('workflow_dispatch:');
  expect(workflow).toContain('MOBILE_E2E_CALENDAR_WORKOUT_TITLE');
  expect(workflow).toContain('WORKOUT_TITLE="$STAGING_CALENDAR_WORKOUT_TITLE"');
  expect(workflow).toContain('calendar-read) FLOW_FILE=workout-calendar-smoke.yaml');
  expect(flow).toContain('id: calendar-mode-month');
  expect(flow).toContain('id: calendar-mode-week');
  expect(flow).toContain('id: calendar-week-agenda');
  expect(flow).toContain('id: calendar-previous');
  expect(flow.match(/id: calendar-today/g)).toHaveLength(3);
  expect(flow).toContain('id: workout-details-scroll');
  expect(flow).not.toMatch(/^\s*- (?:http|api|fetch|request|post|runScript):/m);
  expect(flow).not.toMatch(/workout-status-action|create-workout-submit|workout-draft-send/);
  expect(screen).toContain('testID={`calendar-mode-${value}`}');
  expect(screen).toContain('testID="calendar-week-agenda"');
  expect(read('../docs/native-staging-smoke.md')).toContain('zero workout POST');
});
