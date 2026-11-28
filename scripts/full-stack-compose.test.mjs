import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const full = read('infra/docker/compose.full-stack.yaml');
const rehearsal = read('infra/docker/compose.rehearsal.yaml');
const runner = read('scripts/full-stack-rehearsal.mjs');
const workflow = read('.github/workflows/ci.yml');

test('full-stack pilot is a separate project and preserves API-only release contract', () => {
  assert.match(full, /^name: gym-platform-full-stack-pilot$/m);
  assert.match(full, /ADMIN_APP_URL: \$\{ADMIN_APP_URL:\?/);
  assert.match(full, /TRAINER_APP_URL: \$\{TRAINER_APP_URL:\?/);
  assert.match(full, /GYM_API_INTERNAL_URL: http:\/\/api:3000/);
  assert.match(full, /condition: service_healthy/);
  for (const app of ['landing', 'web', 'trainer', 'admin']) {
    assert.ok(full.includes('dockerfile: apps/' + app + '/Dockerfile'));
  }
  assert.equal((full.match(/127\.0\.0\.1:/g) ?? []).length, 4);
  assert.doesNotMatch(full, /^  (postgres|redis|migrate):/m);
  assert.match(read('infra/docker/compose.prod.yaml'), /^name: gym-platform-api$/m);
  assert.match(read('infra/docker/compose.digest.prod.yaml'), /DEPLOY_RUNTIME_IMAGE:\?/);
});

test('rehearsal isolates database, credentials, networking and one-shot migration', () => {
  assert.match(rehearsal, /internal: true/);
  assert.equal((rehearsal.match(/ports: !reset \[\]/g) ?? []).length, 5);
  assert.doesNotMatch(rehearsal, /external: true|container_name:/);
  assert.match(rehearsal, /NOTIFICATION_DISPATCH_ENABLED: 'false'/);
  assert.match(rehearsal, /NOTIFICATION_EMAIL_ENABLED: 'false'/);
  assert.match(runner, /@postgres:5432\/gym_rehearsal/);
  assert.match(runner, /createMailOverlay/);
  assert.match(read('scripts/full-stack-staging-mail.mjs'), /smtps:\/\/mailpit:465/);
  assert.match(runner, /randomBytes\(8\)/);
  assert.match(runner, /--project-name/);
  assert.match(runner, /--env-file/);
  assert.match(runner, /validated = true/);
  assert.match(runner, /'run', '--rm', '--no-deps', '--pull', 'never', 'migrate'/);
  assert.match(runner, /'down', '--volumes', '--remove-orphans'/);
  assert.doesNotMatch(runner, /db:seed|db:reset|docker system prune/);
  assert.match(
    workflow,
    /if: needs\.changes\.outputs\.full == 'true'\n\s+run: node scripts\/full-stack-rehearsal\.mjs/,
  );
});
