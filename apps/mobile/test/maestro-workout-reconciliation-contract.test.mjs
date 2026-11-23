import { readFileSync } from 'node:fs';
import { test, expect } from 'vitest';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const flowRoot = '../maestro/flows/';
const workflow = read('../../../.github/workflows/mobile-native-e2e.yml');
const resume = read(`${flowRoot}workout-reconcile-resume.yaml`);
const offline = read(`${flowRoot}workout-reconcile-offline-android.yaml`);
const lost = read(`${flowRoot}workout-reconcile-lost-response.yaml`);
const shared = read('../maestro/partials/open-seeded-workout.yaml');
const nativeDocs = read('../docs/native-staging-smoke.md');
const row = read('../src/screens/workouts/ui/workout-set-row.tsx');
const screen = read('../src/screens/workouts/ui/workout-details-screen.tsx');

const routes = [
  ['reconcile-resume', 'workout-reconcile-resume.yaml'],
  ['reconcile-offline-android', 'workout-reconcile-offline-android.yaml'],
  ['reconcile-lost-response', 'workout-reconcile-lost-response.yaml'],
];

test('all new native flows stay opt-in, approved main-only staging and verified EAS APK', () => {
  expect(workflow).toContain('workflow_dispatch:');
  expect(workflow).toContain('environment: mobile-staging');
  expect(workflow).toContain('"$GITHUB_REF" != \'refs/heads/main\'');
  expect(workflow).not.toMatch(/on:\s*\n\s*(?:push|pull_request):/);
  expect(workflow).toContain('MOBILE_STAGING_ANDROID_APP_ID');
  expect(workflow).toContain('MOBILE_E2E_RECONCILE_WORKOUT_TITLE');
  expect(workflow).toContain('"$APP_ID" != "$EXPECTED_STAGING_APP_ID"');
  expect(workflow).toContain('"$FLOW" == reconcile-*');
  expect(workflow).toContain('"$STAGING_RECONCILE_WORKOUT_TITLE"');
  expect(workflow).toContain('sha256sum --check --status');
  expect(workflow).toContain('dump badging');
  expect(workflow).toContain('validate-mobile-smoke-inputs.mjs');
  expect(workflow).toContain("MAESTRO_VERSION: '2.12.1'");
  expect(workflow).toContain(
    'reactivecircus/android-emulator-runner@a421e43855164a8197daf9d8d40fe71c6996bb0d # v2',
  );
  expect(workflow).toContain('MOBILE_E2E_EMAIL');
  expect(workflow).toContain('MOBILE_E2E_PASSWORD');
  expect(workflow).toContain('E2E_WORKOUT_TITLE="$WORKOUT_TITLE"');

  const protect = workflow.indexOf('"$FLOW" == reconcile-*');
  const apk = workflow.indexOf('curl --fail --location');
  expect(protect).toBeGreaterThan(-1);
  expect(apk).toBeGreaterThan(protect);

  for (const [name, filename] of routes) {
    expect(workflow).toContain(`- ${name}`);
    expect(workflow).toContain(`${name}) FLOW_FILE=${filename}`);
  }
  // The old write smoke must retain unique run-based titles and its old selectors.
  expect(workflow).toContain('WORKOUT_TITLE="Mobile-smoke-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"');
  expect(workflow).toContain('workout-write) FLOW_FILE=workout-write-smoke.yaml');
});

test('seeded workout navigation uses actual current native selectors (no secrets in flows)', () => {
  expect(shared).toContain('appId: ${APP_ID}');
  expect(shared).toContain('E2E_EMAIL');
  expect(shared).toContain('E2E_PASSWORD');
  expect(shared).toContain('E2E_WORKOUT_TITLE');
  expect(shared).toContain('id: mobile-tab-workouts');
  expect(shared).toContain('clearState: true');
  expect(read('../src/app/(tabs)/_layout.tsx')).toContain(
    "tabBarButtonTestID: 'mobile-tab-workouts'",
  );
  expect(read('../src/screens/sign-in/ui/sign-in-screen.tsx')).toContain('sign-in-email');
  expect(read('../src/screens/sign-in/ui/sign-in-screen.tsx')).toContain('sign-in-password');
  for (const flow of [resume, offline, lost]) {
    expect(flow).toContain('- runFlow: ../partials/open-seeded-workout.yaml');
    expect(flow).toContain('appId: ${APP_ID}');
    expect(flow).toContain('Очікує');
    expect(flow).not.toMatch(/@example\.com|password123|localhost|127\.0\.0\.1/);
  }
});

test('iOS and Android resume and lost-response flows exercise real background/foreground, not restart-only', () => {
  for (const flow of [resume, lost]) {
    expect(flow).toContain('- pressKey: home');
    expect(flow).toMatch(/- launchApp:\n\s+stopApp: false/);
    expect(flow).toContain('- stopApp');
    expect(flow).toContain('clearState: false');
    expect(flow).toContain('✓ Збережено');
    expect(flow).not.toContain('setAirplaneMode:');
    expect(flow).not.toContain('runScript:');
    expect(flow).not.toMatch(/^\s*- (?:http|api|fetch|request|patch):/m); // UI-only; backend write count is audited separately.
  }
  expect(resume).toContain('Підтвердити підхід');
  expect(lost).toContain('Стан отримано із сервера.*');
  expect(lost).toContain('assertNotVisible:');
  expect(nativeDocs).toContain('Exactly **one**');
  expect(nativeDocs).toContain('NO-GO');
});

test('Android offline preflight is not misrepresented as a lost post-commit response', () => {
  expect(offline).toContain('setAirplaneMode: enabled');
  expect(offline).toContain('setAirplaneMode: disabled');
  expect(offline).toContain('Немає мережі. Підхід не надіслано.');
  expect(offline).toContain('assertNotVisible: ✓ Збережено');
  expect(offline).toContain('- pressKey: home');
  expect(nativeDocs).toContain('Android only');
  expect(nativeDocs).toContain('Zero'); // explicit zero-write requirement in evidence
  expect(nativeDocs).toContain('**Zero** PATCH');
  expect(nativeDocs).toContain('staging-only');
});

test('reconciliation flows are bound to real UI labels and cannot falsely pass a normal 200 PATCH', () => {
  expect(row).toContain('Підтвердити підхід');
  expect(row).toContain('✓ Збережено');
  expect(read('../src/features/workouts/model/workout-set-mutation.ts')).toContain(
    'Немає мережі. Підхід не надіслано.',
  );
  expect(row).toContain('Запис міг бути збережений.');
  expect(row).toContain('Стан отримано із сервера.');
  expect(screen).toContain('canonicalReadVersion={details.canonicalReadVersion}');
  expect(lost).toMatch(/extendedWaitUntil:[\s\S]*?Стан отримано із сервера\.\*/);
  expect(lost).toContain('operator must independently verify exactly ONE PATCH');
  expect(nativeDocs).toContain('normal successful PATCH');
  expect(nativeDocs).toContain('fault injector');
  expect(nativeDocs).toContain('iOS');
  expect(nativeDocs).toContain('not** currently define or provision');
  expect(nativeDocs).not.toContain('Production traffic is permitted');
});
