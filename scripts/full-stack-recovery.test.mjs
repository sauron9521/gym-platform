import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';
import { recoveryNames } from './full-stack-recovery.mjs';

test('recovery accepts only random rehearsal project and fixes isolated target names', () => {
  const project = 'ovranto-rehearsal-0123456789abcdef';
  assert.deepEqual(recoveryNames(project), {
    source: 'gym_rehearsal',
    target: 'gym_rehearsal_restore_test',
    volume: project + '_restored_avatars',
  });
  for (const name of [
    'gym-platform-api',
    'gym-platform',
    'production',
    'ovranto-rehearsal-1234',
    'ovranto-rehearsal-0123456789abcdef-other',
  ])
    assert.throws(() => recoveryNames(name));
});
test('recovery reuses guarded restore and checks preserved data without mutating deployment contracts', () => {
  const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const script = read('scripts/full-stack-recovery.mjs');
  assert.match(script, /com\.docker\.compose\.project/);
  assert.match(script, /com\.docker\.compose\.volume/);
  assert.match(script, /compose\('stop', 'api'\)/);
  assert.match(script, /restore-drill\.sh/);
  assert.match(script, /I_ACKNOWLEDGE_ISOLATED_RESTORE/);
  assert.match(script, /assert\.throws\(restore, \//);
  assert.match(script, /assert\.equal\(migrations\(names\.target\), ledger\)/);
  assert.match(script, /assert\.equal\(readFixture\(names\.source\), expected\)/);
  assert.match(script, /dst=\/avatars,readonly/);
  assert.match(script, /input: archive/);
  assert.match(script, /assert\.equal\(restored\.split/);
  assert.doesNotMatch(script, /DROP DATABASE|TRUNCATE|docker system prune|--network', 'host'/);
  assert.match(read('scripts/full-stack-rehearsal.mjs'), /await probeFullStackRecovery\(/);
});
