import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import {
  validateIdentity, validateCompose, validatePulled, validateCurrent,
} from './production-digest-guard.mjs';

const sha = 'a'.repeat(40);
const pub = 'b'.repeat(40);
const runtime = 'ghcr.io/sauron9521/gym-platform@sha256:' + 'c'.repeat(64);
const migrate = 'ghcr.io/sauron9521/gym-platform-migrate@sha256:' + 'd'.repeat(64);
const old = 'ghcr.io/sauron9521/gym-platform@sha256:' + 'e'.repeat(64);
const env = { DEPLOY_RUNTIME_IMAGE: runtime, DEPLOY_MIGRATE_IMAGE: migrate,
  SOURCE_SHA: sha, PUBLISH_SHA: pub, EXPECTED_CURRENT_IMAGE: old };
const validConfig = () => ({ name: 'gym-platform-api', services: {
  api: {
    image: runtime, init: true, read_only: true, restart: 'unless-stopped',
    cap_drop: ['ALL'], security_opt: ['no-new-privileges:true'],
    mem_limit: 1073741824, memswap_limit: 1073741824, cpus: 2, pids_limit: 256,
    ports: [{ host_ip: '127.0.0.1', target: 3000, published: '3001' }],
    volumes: [{ type: 'volume', source: 'avatars', target: '/app/uploads/avatars' }],
  },
  migrate: {
    image: migrate, restart: 'no', profiles: ['ops'], read_only: true,
    cap_drop: ['ALL'], security_opt: ['no-new-privileges:true'],
  },
} });

test('requires exact repository-scoped digests and both source identities', () => {
  assert.equal(validateIdentity(env).previous, old);
  assert.equal(validateIdentity({ ...env, EXPECTED_CURRENT_IMAGE: 'none' }).previous, 'none');
  for (const bad of [
    { DEPLOY_RUNTIME_IMAGE: runtime.replace('@sha256:', ':latest-') },
    { DEPLOY_RUNTIME_IMAGE: runtime.replace('sauron9521', 'another') },
    { DEPLOY_MIGRATE_IMAGE: runtime },
    { SOURCE_SHA: 'main' }, { PUBLISH_SHA: '' },
    { EXPECTED_CURRENT_IMAGE: 'gym-api:local' },
    { EXPECTED_CURRENT_IMAGE: runtime },
    { EXPECTED_CURRENT_IMAGE: undefined },
  ]) assert.throws(() => validateIdentity({ ...env, ...bad }));
});

test('digest override must preserve original hardened Compose contract', () => {
  const id = validateIdentity(env);
  assert.equal(validateCompose(validConfig(), id), true);
  const mutations = [
    (c) => { c.services.api.build = { context: '.' }; },
    (c) => { c.services.migrate.build = { context: '.' }; },
    (c) => { c.services.api.image = 'gym-api:local'; },
    (c) => { c.services.api.ports[0].host_ip = '0.0.0.0'; },
    (c) => { c.services.api.read_only = false; },
    (c) => { c.services.api.mem_limit = 0; },
    (c) => { c.services.api.cap_drop = []; },
    (c) => { c.services.api.security_opt = []; },
    (c) => { c.services.api.volumes = []; },
    (c) => { c.services.migrate.profiles = []; },
    (c) => { c.services.migrate.restart = 'always'; },
    (c) => { c.services.migrate.image = 'latest'; },
  ];
  for (const mutate of mutations) {
    const config = validConfig();
    mutate(config);
    assert.throws(() => validateCompose(config, id));
  }
});

test('Docker image must match digest, non-root UID, architecture and source label', () => {
  const good = {
    Id: 'sha256:' + 'f'.repeat(64), RepoDigests: [runtime],
    Os: 'linux', Architecture: 'amd64',
    Config: { User: 'node', Labels: { 'org.opencontainers.image.revision': sha } },
  };
  assert.equal(validatePulled(good, runtime, sha), true);
  for (const patch of [
    { RepoDigests: [migrate] },
    { Os: 'windows' }, { Architecture: 'arm64' },
    { Config: { User: 'root', Labels: { 'org.opencontainers.image.revision': sha } } },
    { Config: { User: 'node', Labels: { 'org.opencontainers.image.revision': pub } } },
  ]) assert.throws(() => validatePulled({ ...good, ...patch }, runtime, sha));
});

test('observed running image must match operator-approved previous image', () => {
  assert.equal(validateCurrent(old, old), true);
  assert.equal(validateCurrent('', 'none'), true);
  assert.throws(() => validateCurrent('gym-api:local', 'none'));
  assert.throws(() => validateCurrent(runtime, old));
});

test('digest-only override is opt-in and future operator deployment is not wired into CI', async () => {
  const override = await readFile(
    new URL('../infra/docker/compose.digest.prod.yaml', import.meta.url),
    'utf8',
  );
  const ci = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  assert.equal((override.match(/build: !reset null/g) ?? []).length, 2);
  assert.match(override, /DEPLOY_RUNTIME_IMAGE/);
  assert.match(override, /DEPLOY_MIGRATE_IMAGE/);
  assert.ok(ci.includes('node --test scripts/production-digest-guard.test.mjs'));
  assert.ok(ci.includes('docker compose --env-file infra/docker/.env.example'));
  assert.ok(!ci.includes('production-digest-deploy.sh apply'));
});

test('reject unexpected Compose project or exposed migrations ports', () => {
  const id = validateIdentity(env);
  for (const mutate of [
    (c) => { c.name = 'another-app'; },
    (c) => { c.services.migrate.read_only = false; },
    (c) => { c.services.migrate.ports = [{ host_ip: '0.0.0.0', target: 5432 }]; },
    (c) => { c.services.extra = { image: 'unknown' }; },
    (c) => { c.services.api.ports[0].published = '0'; },
  ]) {
    const cfg = validConfig();
    mutate(cfg);
    assert.throws(() => validateCompose(cfg, id));
  }
});
