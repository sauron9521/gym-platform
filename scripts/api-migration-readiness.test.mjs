import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import {
  buildReadinessReport,
  CUTOVER_GATES,
  inspectCutoverArtifacts,
  renderMarkdown,
  REQUIRED_ARTIFACTS,
  STAGING_BLOCKERS,
  verifySourceInventory,
} from './api-migration-readiness.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const inventory = JSON.parse(
  readFileSync(join(root, 'apps/api/migration-source-inventory.json'), 'utf8'),
);

test('all original 302 source files and 48 test paths exist inside apps/api', () => {
  const counts = verifySourceInventory(inventory, root);
  assert.deepEqual(counts, {
    sourceFiles: 302,
    testFiles: 48,
    sourceUnchanged: 86,
    sourceAdapted: 216,
    testUnchanged: 2,
    testAdapted: 46,
  });
  assert.equal(inventory.legacy_commit, '79e53bc1b7a78bb3856ff2aeab2529559240521e');
});

test('source inventory rejects duplicates, path traversal and missing imported paths', () => {
  const first = inventory.files[0];
  for (const bad of [
    { ...first, path: 'src/../../secrets.txt' },
    { ...first, path: 'docs/README.md' },
    { ...first, path: 'src/not-imported-file.ts' },
    { ...first, legacy_sha: 'wrong-sha' },
    { ...first, at_audit: 'unverified' },
  ]) {
    const altered = { ...inventory, files: [bad, ...inventory.files.slice(1)] };
    assert.throws(() => verifySourceInventory(altered, root));
  }
  assert.throws(() =>
    verifySourceInventory(
      {
        ...inventory,
        files: [inventory.files[0], inventory.files[0], ...inventory.files.slice(2)],
      },
      root,
    ),
  );
});

test('required infrastructure is checked and staging omissions are explicit', () => {
  const artifacts = inspectCutoverArtifacts(root);
  assert.deepEqual(artifacts.missingRequired, []);
  assert.equal(REQUIRED_ARTIFACTS.length >= 12, true);
  for (const path of STAGING_BLOCKERS) {
    assert.ok(path.startsWith('.github/workflows/'));
    assert.ok(artifacts.staging.some((entry) => entry.path === path));
  }
});

test('readiness report is unconditionally NO-GO without validated operator evidence', () => {
  const report = buildReadinessReport(inventory, root);
  const text = renderMarkdown(report);
  assert.equal(report.status, 'NO_GO');
  assert.equal(report.releaseApprovalGranted, false);
  assert.equal(report.requiredOperatorEvidence.length, 8);
  assert.equal(CUTOVER_GATES.length, 8);
  assert.match(text, /production NO-GO/);
  assert.match(text, /staging/);
  assert.match(text, /Prisma schemas: 10/);
  assert.match(text, /Human-reviewed evidence/);
});

test('report cannot conceal missing required files or invent approval', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'gym-cutover-preflight-'));
  try {
    const result = inspectCutoverArtifacts(scratch);
    assert.equal(result.missingRequired.length, REQUIRED_ARTIFACTS.length);
    assert.equal(result.missingStaging.length, STAGING_BLOCKERS.length);
    assert.ok(!existsSync(join(scratch, '.github/workflows/ci.yml')));
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
