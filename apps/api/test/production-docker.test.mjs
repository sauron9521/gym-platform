import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Dockerfile uses Node 24/pnpm and isolates the production runtime', async () => {
  const docker = await read('../Dockerfile');
  assert.ok(docker.includes('ARG NODE_BASE_IMAGE=node:24-trixie-slim'));
  assert.ok(docker.includes('FROM ${NODE_BASE_IMAGE} AS base'));
  assert.ok(docker.includes('FROM build AS migrate'));
  assert.ok(docker.includes('FROM ${NODE_BASE_IMAGE} AS runtime'));
  assert.ok(docker.includes('pnpm install --frozen-lockfile'));
  assert.ok(docker.includes('pnpm --filter @gym/api db:generate'));
  assert.ok(docker.includes('pnpm --filter @gym/api --prod deploy'));
  assert.ok(docker.includes('COPY --from=build /workspace/apps/api/dist/ ./dist/'));
  assert.ok(docker.includes('USER node'));
  assert.ok(docker.includes('CMD ["node", "dist/main.js"]'));
});

test('production Compose is separate, manual, and does not start a database', async () => {
  const config = await read('../../../infra/docker/compose.prod.yaml');
  assert.match(config, /dockerfile: apps\/api\/Dockerfile/);
  assert.match(config, /context: \.\.\/\.\./);
  assert.match(config, /target: runtime/);
  assert.match(config, /target: migrate/);
  assert.match(config, /profiles: \[ops\]/);
  assert.match(config, /read_only: true/);
  assert.match(config, /no-new-privileges:true/);
  assert.match(config, /127\.0\.0\.1:/);
  assert.doesNotMatch(config, /^\s{2}postgres:/m);
  assert.doesNotMatch(config, /^\s{2}redis:/m);
});

test('Docker build context excludes credentials and generated state', async () => {
  const ignore = await read('../../../.dockerignore');
  assert.match(ignore, /^\*\*\/\.env$/m);
  assert.match(ignore, /^\*\*\/\.env\.\*$/m);
  assert.match(ignore, /^\*\*\/node_modules$/m);
  assert.match(ignore, /^\*\*\/src\/infra\/database\/generated$/m);
  assert.match(ignore, /^\.git$/m);
});
