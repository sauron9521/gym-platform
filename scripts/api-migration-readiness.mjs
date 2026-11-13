#!/usr/bin/env node
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

export const CUTOVER_GATES = Object.freeze([
  {
    id: 'signed-ghcr-images',
    label: 'Publish and verify both digest-pinned, attested GHCR images',
  },
  {
    id: 'signed-staging-smoke',
    label: 'Run an ephemeral signed-image staging smoke against PostgreSQL and Redis',
  },
  {
    id: 'two-release-rollback',
    label: 'Prove old/new runtime compatibility, safe migrations and runtime rollback',
  },
  {
    id: 'api-functional-parity',
    label: 'Validate authentication, profiles, exercises, workouts, trainer workflows and mail',
  },
  {
    id: 'backup-offsite-restore',
    label: 'Verify encrypted off-site PostgreSQL and avatar backups, and a full restore drill',
  },
  {
    id: 'production-security',
    label: 'Review TLS, reverse proxy, cookies, CSRF, rate limits, secrets and storage access',
  },
  {
    id: 'alert-delivery',
    label: 'Demonstrate monitoring, alert delivery, acknowledgement and escalation',
  },
  {
    id: 'cutover-approval',
    label:
      'Obtain an explicit operator change window, rollback plan and repository handover approval',
  },
]);

export const REQUIRED_ARTIFACTS = Object.freeze([
  'apps/api/Dockerfile',
  'apps/api/migration-baseline.json',
  'apps/api/test/migration-baseline.test.mjs',
  'apps/api/openapi/openapi.json',
  'packages/api-client/src/generated/schema.d.ts',
  '.github/workflows/ci.yml',
  '.github/workflows/release-artifacts.yml',
  '.github/workflows/publish-ghcr.yml',
  'infra/docker/compose.prod.yaml',
  'scripts/backup-production.sh',
  'scripts/restore-drill.sh',
  'scripts/monitoring-collect.sh',
  'scripts/monitoring-forward.sh',
  'ops/monitoring/alerts.rules.yml',
  'ops/monitoring/slo.rules.yml',
]);

export const STAGING_BLOCKERS = Object.freeze([
  '.github/workflows/staging-ghcr.yml',
  '.github/workflows/staging-upgrade-rollback.yml',
  '.github/workflows/production-readiness.yml',
]);

function safeInventoryPath(value) {
  if (typeof value !== 'string' || !(value.startsWith('src/') || value.startsWith('test/'))) {
    return false;
  }
  return (
    /^[a-zA-Z0-9_./-]+$/.test(value) &&
    !value.split('/').includes('..') &&
    !value.split('/').includes('.') &&
    !value.endsWith('/')
  );
}

function regularFile(path) {
  try {
    return lstatSync(path).isFile();
  } catch {
    return false;
  }
}

export function verifySourceInventory(inventory, checkoutRoot) {
  if (
    !inventory ||
    inventory.legacy_repository !== 'sauron9521/gym-api-nestjs' ||
    inventory.monorepo_repository !== 'sauron9521/gym-platform' ||
    !/^[a-f0-9]{40}$/.test(inventory.legacy_commit ?? '') ||
    !/^[a-f0-9]{40}$/.test(inventory.monorepo_commit ?? '') ||
    !Array.isArray(inventory.files)
  ) {
    throw new Error('Invalid migration inventory provenance');
  }

  const encountered = new Set();
  const counters = {
    sourceFiles: 0,
    testFiles: 0,
    sourceUnchanged: 0,
    sourceAdapted: 0,
    testUnchanged: 0,
    testAdapted: 0,
  };

  for (const item of inventory.files) {
    if (
      !safeInventoryPath(item?.path) ||
      !/^[a-f0-9]{40}$/.test(item.legacy_sha ?? '') ||
      !['unchanged', 'adapted'].includes(item.at_audit) ||
      encountered.has(item.path)
    ) {
      throw new Error('Invalid or duplicate source inventory entry');
    }
    encountered.add(item.path);
    if (!regularFile(join(checkoutRoot, 'apps/api', item.path))) {
      throw new Error('Source or test file missing: ' + item.path);
    }

    const isSource = item.path.startsWith('src/');
    if (isSource) {
      counters.sourceFiles++;
      counters[item.at_audit === 'unchanged' ? 'sourceUnchanged' : 'sourceAdapted']++;
    } else {
      counters.testFiles++;
      counters[item.at_audit === 'unchanged' ? 'testUnchanged' : 'testAdapted']++;
    }
  }

  const audit = inventory.historical_snapshot;
  for (const [key, expected] of [
    ['source_files', counters.sourceFiles],
    ['test_files', counters.testFiles],
    ['src_unchanged', counters.sourceUnchanged],
    ['src_adapted', counters.sourceAdapted],
    ['test_unchanged', counters.testUnchanged],
    ['test_adapted', counters.testAdapted],
    ['prisma_schemas_unchanged', 10],
    ['prisma_migration_files_unchanged', 25],
  ]) {
    if (audit?.[key] !== expected) {
      throw new Error('Migration snapshot count mismatch: ' + key);
    }
  }

  if (counters.sourceFiles !== 302 || counters.testFiles !== 48) {
    throw new Error('Unexpected legacy source/test coverage');
  }

  return counters;
}

export function inspectCutoverArtifacts(checkoutRoot) {
  const files = REQUIRED_ARTIFACTS.map((path) => ({
    path,
    present: regularFile(join(checkoutRoot, path)),
  }));
  const staging = STAGING_BLOCKERS.map((path) => ({
    path,
    present: regularFile(join(checkoutRoot, path)),
  }));
  return {
    files,
    staging,
    missingRequired: files.filter((item) => !item.present).map((item) => item.path),
    missingStaging: staging.filter((item) => !item.present).map((item) => item.path),
  };
}

export function buildReadinessReport(inventory, checkoutRoot) {
  const counts = verifySourceInventory(inventory, checkoutRoot);
  const artifacts = inspectCutoverArtifacts(checkoutRoot);
  // This is a read-only REPOSITORY audit, never production authorization.
  // Passing local checks cannot prove deployed digest identity, staging
  // compatibility, external backup restorability or human approval.
  return {
    status: 'NO_GO',
    auditKind: 'repository-cutover-preflight',
    legacyCommit: inventory.legacy_commit,
    monorepoAuditCommit: inventory.monorepo_commit,
    counts,
    artifacts,
    requiredOperatorEvidence: CUTOVER_GATES,
    releaseApprovalGranted: false,
  };
}

export function renderMarkdown(report) {
  const missingStaging =
    report.artifacts.missingStaging.length === 0
      ? 'None absent from the repository (manual successful runs still required)'
      : report.artifacts.missingStaging.map((path) => '- ' + path).join('\n');
  const missingRequired =
    report.artifacts.missingRequired.length === 0
      ? 'None'
      : report.artifacts.missingRequired.map((path) => '- ' + path).join('\n');

  return [
    '### API migration audit — production NO-GO',
    '',
    'Legacy API commit: ' + report.legacyCommit,
    'Monorepo audit commit: ' + report.monorepoAuditCommit,
    '',
    '- Imported source paths: ' + report.counts.sourceFiles,
    '  (historically unchanged: ' +
      report.counts.sourceUnchanged +
      '; adapted: ' +
      report.counts.sourceAdapted +
      ')',
    '- Imported test paths: ' + report.counts.testFiles,
    '  (historically unchanged: ' +
      report.counts.testUnchanged +
      '; adapted: ' +
      report.counts.testAdapted +
      ')',
    '- Original Prisma schemas: 10; migration files: 25',
    '',
    '**Required repository artifacts missing:**',
    '',
    missingRequired,
    '',
    '**Staging/release review workflows not yet migrated:**',
    '',
    missingStaging,
    '',
    '**Human-reviewed evidence still required before any cutover:**',
    '',
    ...report.requiredOperatorEvidence.map((gate) => '- ' + gate.label),
    '',
    '**Decision: NO-GO.** This automated report NEVER approves production',
    'deployment, database migrations, archival of the standalone repository,',
    'or operational handover.',
    '',
  ].join('\n');
}

function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !['--report', '--require-ready'].includes(args[0])) {
    throw new Error('Usage: node scripts/api-migration-readiness.mjs --report|--require-ready');
  }
  const manifest = JSON.parse(
    readFileSync(join(root, 'apps/api/migration-source-inventory.json'), 'utf8'),
  );
  const report = buildReadinessReport(manifest, root);
  if (args[0] === '--report') {
    process.stdout.write(renderMarkdown(report));
    return;
  }
  throw new Error(
    'Production cutover is not authorized; require signed GHCR, staging rollback and operator approval',
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(
      error instanceof Error ? error.message + '\n' : 'Migration audit failed\n',
    );
    process.exitCode = 1;
  }
}
