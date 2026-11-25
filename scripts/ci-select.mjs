import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const commitSha = /^[0-9a-f]{40}$/i;

const monitoringShadowPaths = new Set([
  'ops/monitoring/shadow/config.alloy',
  'ops/monitoring/shadow/fixture.compose.yml',
  'ops/monitoring/shadow/prometheus.yml',
  'ops/monitoring/shadow/shadow.rules.yml',
  'ops/monitoring/shadow/shadow.test.yml',
  'scripts/monitoring-platform.test.mjs',
  'scripts/monitoring-shadow-evidence.mjs',
  'scripts/monitoring-shadow-evidence.test.mjs',
]);

const monitoringShadowTriggers = new Set([
  ...monitoringShadowPaths,
  '.github/workflows/ci.yml',
  '.github/workflows/monitoring-resource-shadow.yml',
  'scripts/ci-select.mjs',
]);

function allScopes() {
  return {
    full: true,
    api: true,
    web: true,
    landing: true,
    admin: true,
    adminBrowser: true,
    trainer: true,
    mobile: true,
    client: true,
    deps: true,
    workspaces: true,
    monitoringShadow: true,
    redis: false,
  };
}

export function classifyChangedPaths(paths, { forceFull = false } = {}) {
  if (forceFull || !Array.isArray(paths) || paths.length === 0) {
    return allScopes();
  }

  const selected = {
    full: false,
    api: false,
    web: false,
    landing: false,
    admin: false,
    adminBrowser: false,
    trainer: false,
    mobile: false,
    client: false,
    deps: false,
    workspaces: false,
    monitoringShadow: paths.some(
      (raw) => typeof raw === 'string' && monitoringShadowTriggers.has(raw.replaceAll('\\', '/')),
    ),
    redis: paths.some(
      (raw) =>
        typeof raw === 'string' &&
        [
          'infra/docker/compose.yaml',
          'scripts/test-redis-upgrade.sh',
          'scripts/ci-select.mjs',
          '.github/workflows/ci.yml',
        ].includes(raw.replaceAll('\\', '/')),
    ),
  };

  for (const rawPath of paths) {
    if (typeof rawPath !== 'string' || !rawPath.trim()) {
      return allScopes();
    }

    const path = rawPath.replaceAll('\\', '/');
    if (path.startsWith('/') || path.split('/').includes('..')) {
      return allScopes();
    }

    // Documentation-only changes do not alter app/runtime behavior.
    // Keep this narrow: Markdown outside these known documentation locations
    // (including unknown packages, tooling and GitHub config) fails closed.
    if (
      path.startsWith('docs/') ||
      /^[^/]+\.md$/.test(path) ||
      /^infra\/(?:[^/]+\/)*[^/]+\.md$/.test(path) ||
      /^apps\/mobile\/docs\/(?:[^/]+\/)*[^/]+\.md$/.test(path) ||
      [
        'apps/api/README.md',
        'apps/api/test/README.md',
        'apps/web/README.md',
        'apps/admin/README.md',
        'apps/trainer/README.md',
        'apps/landing/README.md',
        'apps/mobile/README.md',
        'packages/api-client/README.md',
      ].includes(path)
    ) {
      continue;
    }

    // The isolated shadow pilot has its own offline validators.
    if (monitoringShadowPaths.has(path)) continue;

    // The committed OpenAPI contract affects every generated API-client consumer.
    if (path.startsWith('apps/api/openapi/')) {
      selected.api = true;
      selected.web = true;
      selected.admin = true;
      selected.trainer = true;
      selected.mobile = true;
      selected.client = true;
      continue;
    }

    if (path.startsWith('apps/api/')) {
      selected.api = true;
      // The Admin browser smoke exercises the API's cookie and session boundary.
      selected.adminBrowser ||=
        path.startsWith('apps/api/src/modules/auth/') ||
        path.startsWith('apps/api/src/common/auth/') ||
        [
          'apps/api/src/app.module.ts',
          'apps/api/src/main.ts',
          'apps/api/src/common/config/env.schema.ts',
          'apps/api/src/common/config/http.config.ts',
          'apps/api/prisma/schemas/mfa.prisma',
          'apps/api/prisma/schemas/session.prisma',
          'apps/api/test/support/seed-admin-browser.ts',
        ].includes(path);
      if (path === 'apps/api/package.json') selected.deps = true;
      continue;
    }

    if (path.startsWith('apps/web/')) {
      selected.web = true;
      if (path === 'apps/web/package.json') selected.deps = true;
      continue;
    }

    if (path.startsWith('apps/landing/')) {
      selected.landing = true;
      if (path === 'apps/landing/package.json') selected.deps = true;
      continue;
    }

    if (path.startsWith('apps/admin/')) {
      selected.admin = true;
      if (path === 'apps/admin/package.json') selected.deps = true;
      continue;
    }

    if (path.startsWith('apps/trainer/')) {
      selected.trainer = true;
      if (path === 'apps/trainer/package.json') selected.deps = true;
      continue;
    }

    if (path.startsWith('apps/mobile/')) {
      selected.mobile = true;
      if (path === 'apps/mobile/package.json') selected.deps = true;
      continue;
    }

    // Shared client changes require both consumers, not API E2E.
    if (path.startsWith('packages/api-client/')) {
      selected.client = true;
      selected.web = true;
      selected.admin = true;
      selected.trainer = true;
      selected.mobile = true;
      if (path === 'packages/api-client/package.json') selected.deps = true;
      continue;
    }

    // Known shared packages propagate changes to their consumers.
    // Package manifests also require the dependency vulnerability audit.
    // Unknown packages still fail closed to full checks.
    if (path.startsWith('packages/ui-web/')) {
      selected.web = true;
      selected.admin = true;
      selected.trainer = true;
      selected.landing = true;
      if (path === 'packages/ui-web/package.json') selected.deps = true;
      continue;
    }

    if (path.startsWith('packages/i18n/')) {
      // Locale catalogs are also used by the API transactional email flows.
      // Conservatively include API until catalogs are split into independent namespaces.
      selected.api = true;
      selected.web = true;
      selected.landing = true;
      selected.admin = true;
      selected.trainer = true;
      selected.mobile = true;
      if (path === 'packages/i18n/package.json') selected.deps = true;
      continue;
    }

    if (path.startsWith('packages/design-tokens/')) {
      selected.web = true;
      selected.admin = true;
      selected.trainer = true;
      selected.landing = true;
      // Conservative until native design-token consumption is ruled out.
      selected.mobile = true;
      if (path === 'packages/design-tokens/package.json') selected.deps = true;
      continue;
    }

    if (path.startsWith('tooling/config/')) {
      // Adding a package manifest changes the workspace topology.
      if (path === 'tooling/config/package.json') {
        return {
          ...allScopes(),
          monitoringShadow: selected.monitoringShadow,
          redis: selected.redis,
        };
      }
      selected.web = true;
      selected.landing = true;
      selected.admin = true;
      selected.trainer = true;
      continue;
    }

    // Root manifests, lockfile, CI, infra and unknown files invalidate all.
    return { ...allScopes(), monitoringShadow: selected.monitoringShadow, redis: selected.redis };
  }

  selected.adminBrowser ||= selected.admin;
  selected.workspaces =
    selected.api ||
    selected.web ||
    selected.landing ||
    selected.admin ||
    selected.trainer ||
    selected.mobile ||
    selected.client;
  return selected;
}

export function selectFromGitHubEnvironment(env = process.env) {
  // Full main CI is the required release eligibility proof.
  if (env.CI_FORCE_ALL === 'true') {
    return allScopes();
  }

  if (!commitSha.test(env.CI_BASE_SHA ?? '') || !commitSha.test(env.CI_HEAD_SHA ?? '')) {
    throw new Error('PR head/base SHAs are missing or invalid.');
  }

  const names = execFileSync(
    'git',
    ['diff', '--name-only', '-z', '--no-renames', env.CI_BASE_SHA + '...' + env.CI_HEAD_SHA],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    },
  )
    .split('\0')
    .filter(Boolean);

  return classifyChangedPaths(names);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outputPath = process.argv[2] === '--github-output' ? process.argv[3] : null;
  if (!outputPath) {
    throw new Error('Usage: node scripts/ci-select.mjs --github-output <path>');
  }

  const selection = selectFromGitHubEnvironment();
  appendFileSync(
    outputPath,
    Object.entries(selection)
      .map(([key, value]) => key + '=' + value)
      .join('\n') + '\n',
  );
  console.log('CI affected workspace selection:', JSON.stringify(selection));
}
