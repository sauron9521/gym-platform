import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const workspaceRoot = fileURLToPath(new URL('../', import.meta.url));
const integrationDir = fileURLToPath(new URL('../e2e/integration/', import.meta.url));
const specs = readdirSync(integrationDir, { recursive: true })
  .filter((name) => name.endsWith('.spec.ts'))
  .map((name) => name.replaceAll('\\', '/'))
  .sort();

if (specs.length === 0) {
  throw new Error('Real-API browser suite has no integration specs');
}

// Registration and login are intentionally rate-limited per client IP. All
// browser tests originate from loopback, so a single long-lived Nest server
// would incorrectly aggregate unrelated test users into one throttle bucket.
// Restart only the disposable Playwright-managed servers between spec files.
// Never relax security limits or skip a spec to make this suite green.
for (const spec of specs) {
  console.info('Real-API browser integration: ' + spec);
  const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const result = spawnSync(
    command,
    [
      'exec',
      'playwright',
      'test',
      '--config',
      'playwright.integration.config.ts',
      'e2e/integration/' + spec,
    ],
    {
      cwd: workspaceRoot,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    },
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    break;
  }
}
