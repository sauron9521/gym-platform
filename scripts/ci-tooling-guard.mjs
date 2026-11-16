import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// All scripts/*.test.mjs tests run once, even when their isolated API jobs
// only perform shell, infrastructure, deployment and operational checks.
export function assertRequiredRootVitestGate(workflow) {
  const config = readFileSync(new URL('../vitest.config.mts', import.meta.url), 'utf8');
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

  assert.equal(manifest.scripts['test:tooling'], 'vitest run --config vitest.config.mts');
  assert.match(config, /scripts\/\*\.test\.mjs/);
  assert.match(workflow, /^  tooling-contracts:$/m);
  assert.match(workflow, /run: pnpm test:tooling/);
  assert.match(workflow, /TOOLING_CONTRACTS_RESULT: \$\{\{ needs\.tooling-contracts\.result \}\}/);
  assert.match(workflow, /test "\$TOOLING_CONTRACTS_RESULT" = success/);
}
