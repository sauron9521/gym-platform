import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const workflow = read('../../../.github/workflows/mobile-native-e2e.yml');
const docs = read('../docs/native-staging-smoke.md');
const flow = (name) => read(`../maestro/flows/workout-draft-${name}.yaml`);
const partial = (name) => read(`../maestro/partials/${name}.yaml`);

test('draft native flows are manual, main-only and approved staging APK bound', () => {
  expect(workflow).toContain('workflow_dispatch:');
  expect(workflow).toContain('environment: mobile-staging');
  expect(workflow).toContain('"$GITHUB_REF" != \'refs/heads/main\'');
  expect(workflow).not.toMatch(/on:\s*\n\s*(?:push|pull_request):/);
  expect(workflow).toContain('MOBILE_STAGING_ANDROID_APP_ID');
  expect(workflow).toContain('MOBILE_E2E_EXERCISE_NAME');
  const guard = workflow.indexOf('"$FLOW" == draft-*');
  const download = workflow.indexOf('curl --fail --location');
  expect(guard).toBeGreaterThan(-1);
  expect(download).toBeGreaterThan(guard);
  expect(workflow.slice(guard, download)).toContain('"$APP_ID" != "$EXPECTED_STAGING_APP_ID"');
  expect(workflow.slice(guard, download)).toContain('"${E2E_EMAIL,,}" == "${E2E_SECOND_EMAIL,,}"');
  expect(workflow.slice(guard, download)).toContain('^Mobile-draft-fault-[A-Za-z0-9-]{8,64}$');
  expect(workflow).toContain('WORKOUT_TITLE="$DRAFT_FAULT_TITLE"');
  expect(workflow).toContain('sha256sum --check --status');
  expect(workflow).toContain('dump badging');
  for (const name of ['resume', 'lost-response', 'account-isolation']) {
    expect(workflow).toContain(`- draft-${name}`);
    expect(workflow).toContain(`draft-${name}) FLOW_FILE=workout-draft-${name}.yaml`);
  }
});

test('flows use existing UI selectors and local-only preparation, not test API mutation', () => {
  const panel = read('../src/screens/workouts/ui/workout-draft-panel.tsx');
  const create = read('../src/screens/workouts/ui/create-workout-screen.tsx');
  const picker = read('../src/features/exercises/ui/exercise-picker.tsx');
  const messages = read('../src/shared/i18n/mobile-messages.ts');
  const parts = [
    'open-draft-form',
    'save-new-draft',
    'restore-saved-draft',
    'confirm-draft-send',
    'clear-confirmed-draft',
    'sign-out-draft-account',
  ];
  const source = parts.map(partial).join('\n');
  for (const id of ['save', 'restore', 'send', 'clear', 'panel']) {
    expect(panel).toContain(`testID="workout-draft-${id}"`);
    expect(source).toContain(`id: workout-draft-${id}`);
  }
  expect(create).toContain('testID="workout-draft-title-input"');
  expect(picker).toContain('testID="workout-exercise-open"');
  expect(picker).toContain('testID="workout-exercise-search"');
  expect(partial('save-new-draft')).not.toContain('create-workout-submit');
  expect(partial('save-new-draft')).not.toContain('workout-draft-send');
  expect(partial('save-new-draft')).toContain(
    'Чернетку збережено на пристрої. Не надіслано на сервер.',
  );
  expect(panel).toContain("t('confirmTitle')");
  expect(messages).toContain("'mobile.draft.confirmTitle'");
  for (const name of ['resume', 'lost-response', 'account-isolation']) {
    const text = flow(name) + source;
    expect(text).toContain('appId: ${APP_ID}');
    expect(text).not.toMatch(/^\s*- (?:http|api|fetch|request|post|runScript):/m);
    expect(text).not.toMatch(/@example\.com|password123|localhost|127\.0\.0\.1/);
  }
});

test('resume proves explicit restore and receipt after restart, not automatic send', () => {
  const resume = flow('resume');
  expect(resume).toContain('- pressKey: home');
  expect(resume).toContain('stopApp: false');
  expect(resume.match(/- stopApp/g)).toHaveLength(3);
  expect(resume.match(/confirm-draft-send\.yaml/g)).toHaveLength(1);
  expect(resume).toMatch(
    /restore-saved-draft\.yaml[\s\S]*confirm-draft-send\.yaml[\s\S]*Тренування створено на сервері\.[\s\S]*- stopApp[\s\S]*clear-confirmed-draft\.yaml[\s\S]*- stopApp[\s\S]*Збереженої чернетки немає\./,
  );
  expect(partial('confirm-draft-send')).toMatch(
    /id: workout-draft-send[\s\S]*assertVisible: Надіслати саме збережену форму\.\*[\s\S]*tapOn: Надіслати тренування/,
  );
  expect(partial('clear-confirmed-draft')).toContain('Сервер підтвердив створення тренування.*');
});

test('lost response requires an actual pending state and two explicit confirmations', () => {
  const lost = flow('lost-response');
  expect(lost.match(/confirm-draft-send\.yaml/g)).toHaveLength(2);
  expect(lost.match(/Результат надсилання не підтверджено\.\*/g)).toHaveLength(2);
  expect(lost).toMatch(/assertNotVisible:\s+id: workout-draft-discard/);
  expect(lost).toMatch(
    /- stopApp[\s\S]*clearState: false[\s\S]*assertNotVisible:\s+id: workout-draft-send[\s\S]*restore-saved-draft\.yaml[\s\S]*Повторити надсилання/,
  );
  expect(lost).not.toContain('setAirplaneMode:');
  expect(docs).toContain('Exactly two POST requests');
  expect(docs).toContain('first committed response dropped');
  expect(docs).toContain('exactly one resulting workout UUID');
});

test('isolation tests two accounts and requires independent encryption/device evidence', () => {
  const isolation = flow('account-isolation');
  expect(isolation).toContain('E2E_SECOND_EMAIL');
  expect(isolation).toContain('E2E_SECOND_PASSWORD');
  expect(isolation.match(/sign-out-draft-account\.yaml/g)).toHaveLength(2);
  expect(isolation.match(/Збереженої чернетки немає\./g)).toHaveLength(2);
  expect(isolation).not.toContain('confirm-draft-send');
  expect(workflow).toContain('MOBILE_E2E_SECOND_EMAIL');
  expect(workflow).toContain('MOBILE_E2E_SECOND_PASSWORD');
  expect(docs).toContain('Header inspection alone is not proof');
  expect(docs).toContain('NOT RUN / NO-GO');
  expect(docs).toContain('Issue #345 remains open');
});
