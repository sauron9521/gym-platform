import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const commitSha = /^[0-9a-f]{40}$/i;

function allScopes() {
  return {
    full: true,
    api: true,
    web: true,
    mobile: true,
    client: true,
    deps: true,
    workspaces: true,
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
    mobile: false,
    client: false,
    deps: false,
    workspaces: false,
  };

  for (const rawPath of paths) {
    if (typeof rawPath !== 'string' || !rawPath.trim()) {
      return allScopes();
    }

    const path = rawPath.replaceAll('\\', '/');
    if (path.startsWith('/') || path.split('/').includes('..')) {
      return allScopes();
    }

    // Root Markdown and docs never alter application/runtime behavior.
    if (path.startsWith('docs/') || /^[^/]+\.md$/.test(path)) {
      continue;
    }

    // The generated OpenAPI contract is consumed by both frontends.
    if (path.startsWith('apps/api/openapi/')) {
      selected.api = true;
      selected.web = true;
      selected.mobile = true;
      selected.client = true;
      continue;
    }

    if (path.startsWith('apps/api/')) {
      selected.api = true;
      if (path === 'apps/api/package.json') selected.deps = true;
      continue;
    }

    if (path.startsWith('apps/web/')) {
      selected.web = true;
      if (path === 'apps/web/package.json') selected.deps = true;
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
      selected.mobile = true;
      if (path === 'packages/api-client/package.json') selected.deps = true;
      continue;
    }

    // Root manifests, lockfile, CI, infra and unknown files invalidate all.
    return allScopes();
  }

  selected.workspaces = selected.api || selected.web || selected.mobile || selected.client;
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
