import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'vitest';

test('temporary: verify Knip does not flag real Web integration E2E entries', () => {
  const stdout = execFileSync('pnpm', ['knip:report'], {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
    timeout: 120_000,
  });
  const unusedFiles = stdout.match(/Unused files \(\d+\)([\s\S]*?)(?=\n(?:Unused dependencies|Unused devDependencies|Unlisted dependencies|Unused exports|Unused exported types) \(|$)/)?.[1] ?? '';
  const hits = unusedFiles.split('\n').filter((line) =>
    line.includes('apps/web/e2e/integration/') ||
    line.includes('apps/web/playwright.integration.config.ts') ||
    line.includes('apps/web/e2e/support/real-api-accounts.ts') ||
    line.includes('apps/web/e2e/support/training-program-fixtures.ts'),
  );
  console.log('KNIP_WEB_E2E_DIAG=' + JSON.stringify({ flagged: hits, unusedFileHeading: stdout.match(/Unused files \(\d+\)/)?.[0] ?? '(none)' }));
  assert.deepEqual(hits, [], 'Knip incorrectly reports live Web integration E2E entries');
});
