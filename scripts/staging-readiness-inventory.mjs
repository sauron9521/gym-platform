import { closeSync, constants, fstatSync, openSync, readSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const requiredEvidence = [
  'postgresRestoreEvidenceId',
  'avatarRestoreEvidenceId',
  'tlsProxyEvidenceId',
  'smtpDeliveryEvidenceId',
  'redisFailClosedEvidenceId',
  'browserRealApiSmokeEvidenceId',
  'androidMaestroEvidenceId',
  'rollbackRehearsalEvidenceId',
  'alertDeliveryEvidenceId',
];

const evidenceReference = /^[A-Za-z0-9][A-Za-z0-9._:/-]{7,127}$/;
const maxPrivateInventoryBytes = 128_000;

/** Syntactic origin check only. It cannot prove staging isolation or DNS ownership. */
function isHttpsOrigin(value) {
  if (typeof value !== 'string') return false;

  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.origin === value
    );
  } catch {
    return false;
  }
}

/**
 * Strictly read a local, private operator input. Never print file contents
 * or raw error messages: paths and JSON values may be sensitive.
 */
export function readPrivateStagingInventory(path) {
  if (typeof path !== 'string' || !isAbsolute(path)) {
    throw new Error('Private inventory must be an absolute path');
  }

  // Check the opened descriptor, not a prior lstat(path): an attacker could
  // replace the path between lstat and readFileSync (TOCTOU/symlink swap).
  const descriptor = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const stat = fstatSync(descriptor);
    const ownerMismatch =
      process.platform !== 'win32' &&
      typeof process.getuid === 'function' &&
      stat.uid !== process.getuid();
    if (
      !stat.isFile() ||
      stat.size < 1 ||
      stat.size > maxPrivateInventoryBytes ||
      (process.platform !== 'win32' && (stat.mode & 0o077) !== 0) ||
      ownerMismatch
    ) {
      throw new Error('Private inventory is not a safe regular file');
    }

    // Bound even a growing file to at most max bytes + 1; never read a
    // second untrusted unbounded payload after checking metadata.
    const bytes = Buffer.allocUnsafe(maxPrivateInventoryBytes + 1);
    let total = 0;
    while (total < bytes.length) {
      const count = readSync(descriptor, bytes, total, bytes.length - total, null);
      if (count === 0) break;
      total += count;
    }
    if (total < 1 || total > maxPrivateInventoryBytes) {
      throw new Error('Private inventory exceeds the size limit');
    }
    return JSON.parse(bytes.toString('utf8', 0, total));
  } finally {
    closeSync(descriptor);
  }
}

/**
 * This only checks whether operators listed evidence references. It does NOT
 * inspect referenced artifacts, perform network calls or authorize release.
 * Return public field NAMES only; never echo provided input or secret values.
 */
export function inspectStagingReadiness(input) {
  const safeInput = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const missing = [];
  const apiOriginValid = isHttpsOrigin(safeInput.stagingApiOrigin);
  const webOriginValid = isHttpsOrigin(safeInput.stagingWebOrigin);

  if (!apiOriginValid) missing.push('stagingApiOrigin');
  if (!webOriginValid) missing.push('stagingWebOrigin');
  if (
    apiOriginValid &&
    webOriginValid &&
    safeInput.stagingApiOrigin === safeInput.stagingWebOrigin
  ) {
    missing.push('distinctStagingWebAndApiOrigins');
  }

  for (const key of requiredEvidence) {
    if (typeof safeInput[key] !== 'string' || !evidenceReference.test(safeInput[key])) {
      missing.push(key);
    }
  }

  return {
    status: missing.length ? 'INCOMPLETE' : 'SUBMITTED_REQUIRES_INDEPENDENT_REVIEW',
    decision: 'NO_GO',
    missing,
    independentVerificationPerformed: false,
    deploymentAuthorized: false,
    productionContacted: false,
    deployTriggered: false,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!process.argv[2] || process.argv.length !== 3) {
    console.error(
      'Usage: node scripts/staging-readiness-inventory.mjs <absolute-private-json-path>',
    );
    process.exitCode = 2;
  } else {
    try {
      const report = inspectStagingReadiness(readPrivateStagingInventory(process.argv[2]));
      console.log(JSON.stringify(report, null, 2));
      // Exit 0 means only that every reference ID is syntactically present.
      // The decision is ALWAYS NO_GO and this must not be a deployment gate.
      process.exitCode = report.missing.length ? 1 : 0;
    } catch {
      console.error('Unable to read or validate the private staging evidence inventory.');
      process.exitCode = 2;
    }
  }
}
