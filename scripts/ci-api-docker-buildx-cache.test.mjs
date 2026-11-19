import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const workflow = read('../.github/workflows/ci.yml');
const dockerfile = read('../apps/api/Dockerfile');
const job = workflow.split('  api-docker:\n')[1]?.split('\n  api-')[0];

test('Docker CI builds both checked images with Buildx', () => {
  assert.ok(job, 'API Docker job is missing');
  assert.ok(job.includes('name: API Docker / Node 24'));
  assert.ok(job.includes('docker/setup-buildx-action@v4'));
  assert.equal((job.match(/uses: docker\/build-push-action@v7/g) ?? []).length, 2);
  assert.equal((job.match(/          load: true/g) ?? []).length, 2);
  assert.equal((job.match(/          push: false/g) ?? []).length, 2);
  assert.ok(job.includes('          target: runtime\n'));
  assert.ok(job.includes('          target: migrate\n'));
  assert.ok(job.includes('tags: gym-platform-api:runtime-ci'));
  assert.ok(job.includes('tags: gym-platform-api:migrate-ci'));
});

test('both targets read shared GHA cache; only migration exports it', () => {
  assert.ok(job);
  assert.equal((job.match(/cache-from: type=gha,scope=gym-api-migrate/g) ?? []).length, 2);
  assert.equal((job.match(/cache-to: type=gha,/g) ?? []).length, 1);
  assert.ok(job.includes('cache-to: type=gha,scope=gym-api-migrate,mode=max'));
  assert.ok(job.includes('mode=max,ignore-error=true'));
  assert.ok(dockerfile.includes('FROM build AS migration-deps'));
  assert.ok(dockerfile.includes('FROM build AS production-deps'));
  assert.doesNotMatch(job, /docker build -f apps\/api\/Dockerfile/);
});

test('offline runtime and migration image policy tests remain required', () => {
  assert.ok(job);
  assert.ok(job.includes('test/production-docker.test.mjs'));
  assert.ok(job.includes('docker compose -f infra/docker/compose.prod.yaml config --quiet'));
  assert.ok(job.includes('docker run --rm --entrypoint sh gym-platform-api:runtime-ci'));
  assert.ok(job.includes('docker run --rm --entrypoint sh gym-platform-api:migrate-ci'));
  assert.ok(job.includes('node_modules/.bin/prisma --version'));
  assert.ok(job.includes('docker image inspect gym-platform-api:runtime-ci'));
  assert.ok(workflow.includes('name: Quality / Node 24'));
  assert.ok(workflow.includes('name: API e2e / PostgreSQL 17'));
});
