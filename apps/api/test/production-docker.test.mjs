import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'vitest';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Dockerfile uses Node 24/pnpm and isolates the production runtime', async () => {
  const docker = await read('../Dockerfile');
  assert.ok(docker.includes('ARG NODE_BASE_IMAGE=node:24-trixie-slim'));
  assert.ok(docker.includes('FROM ${NODE_BASE_IMAGE} AS base'));
  assert.ok(docker.includes('FROM build AS migration-deps'));
  assert.ok(docker.includes('pnpm --filter @gym/api deploy /app/migrate'));
  assert.ok(docker.includes('FROM ${NODE_BASE_IMAGE} AS migrate'));
  assert.ok(docker.includes('COPY --from=migration-deps /app/migrate/ ./'));
  assert.ok(docker.includes('CMD ["./node_modules/.bin/prisma", "migrate", "deploy"'));
  assert.ok(docker.includes('FROM ${NODE_BASE_IMAGE} AS runtime'));
  assert.ok(docker.includes('pnpm --filter @gym/api... install --frozen-lockfile'));
  assert.doesNotMatch(docker, /^RUN pnpm install --frozen-lockfile$/m);
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

test('Docker dependency install remains cached when only API source changes', async () => {
  const docker = await read('../Dockerfile');
  const build = docker.split('FROM base AS build\n')[1]?.split('\nFROM build AS migration-deps')[0];
  assert.ok(build, 'Build stage missing');
  const manifest = build.indexOf('COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./');
  const workspaces = build.indexOf(
    'COPY --parents apps/*/package.json packages/*/package.json tooling/*/package.json ./',
  );
  const install = build.indexOf('RUN pnpm --filter @gym/api... install --frozen-lockfile');
  const source = build.indexOf('COPY . .');
  const compile = build.indexOf('RUN pnpm --filter @gym/api db:generate');
  assert.ok(manifest >= 0 && manifest < workspaces, 'Root lockfile must be copied first');
  assert.ok(workspaces < install, 'Workspace manifests must precede install');
  assert.ok(install < source, 'All sources must be copied only after install');
  assert.ok(source < compile, 'Prisma generation and Nest build must see source files');
  assert.equal((build.match(/RUN pnpm .* install --frozen-lockfile/g) ?? []).length, 1);
});

test('API Dockerfile-specific ignore only includes required API sources and manifests', async () => {
  const ignore = await read('../Dockerfile.dockerignore');
  const patterns = new Set(ignore.split('\n').map((line) => line.trim()));
  for (const include of [
    '**',
    '!package.json',
    '!pnpm-lock.yaml',
    '!pnpm-workspace.yaml',
    '!apps',
    '!apps/*',
    '!apps/*/package.json',
    '!apps/api/**',
    '!packages',
    '!packages/*',
    '!packages/*/package.json',
    '!tooling',
    '!tooling/*',
    '!tooling/*/package.json',
  ]) {
    assert.ok(patterns.has(include), 'Missing API build context allowlist: ' + include);
  }
  for (const exclude of [
    '**/.env',
    '**/.env.*',
    '**/node_modules',
    'apps/*/**',
    'packages/*/**',
    'tooling/*/**',
    '**/dist',
    '**/test',
    '**/src/infra/database/generated',
    '**/*.pem',
    '**/*.key',
    '**/*.p12',
  ]) {
    assert.ok(patterns.has(exclude), 'Missing sensitive/state exclusion: ' + exclude);
  }
  assert.ok(ignore.indexOf('!apps/api/**') < ignore.indexOf('**/.env'));
  // Later re-inclusions must restore manifests without restoring other sources.
  for (const [deny, manifest] of [
    ['apps/*/**', '!apps/*/package.json'],
    ['packages/*/**', '!packages/*/package.json'],
    ['tooling/*/**', '!tooling/*/package.json'],
  ]) {
    assert.ok(ignore.indexOf(deny) < ignore.indexOf(manifest));
  }
  assert.ok(ignore.indexOf('apps/*/**') < ignore.indexOf('!apps/api/**'));
  const docker = await read('../Dockerfile');
  assert.ok(docker.includes('test -d apps/api/src'));
  assert.ok(docker.includes('test -d apps/api/prisma/migrations'));
  assert.ok(docker.includes('test -f apps/web/package.json'));
  assert.ok(docker.includes('test -f packages/i18n/package.json'));
  assert.ok(docker.includes('test ! -e apps/web/src'));
  assert.ok(docker.includes('test ! -e apps/mobile/src'));
  assert.ok(docker.includes('test ! -e packages/i18n/src'));
});
