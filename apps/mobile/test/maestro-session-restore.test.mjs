import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

test('EAS preview is installable and Maestro native smoke is manual', () => {
  const eas = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8'));
  const flow = readFileSync(
    new URL('../maestro/flows/session-restore-smoke.yaml', import.meta.url),
    'utf8',
  );
  const workflow = readFileSync(
    new URL('../../../.github/workflows/mobile-native-e2e.yml', import.meta.url),
    'utf8',
  );
  assert.equal(eas.build.preview.android.buildType, 'apk');
  assert.match(flow, /clearState: false/);
  assert.match(flow, /- stopApp/);
  assert.match(flow, /- tapOn: Вийти/);
  assert.match(workflow, /workflow_dispatch/);
  assert.match(workflow, /mobile-staging/);
  assert.match(workflow, /reactivecircus\/android-emulator-runner@v2/);
  assert.doesNotMatch(workflow, /on:\s*push/);
  assert.doesNotMatch(flow, /password123|@example\.com/);
});
