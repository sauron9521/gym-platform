/**
 * Safety gate for a future persisted workout draft. Does not store data or send requests.
 * This policy is intentionally fail-closed until the API exposes conflict revisions.
 */
type OfflineDraftBlockReason =
  | 'unverified-session'
  | 'wrong-account'
  | 'offline'
  | 'missing-revision'
  | 'remote-conflict'
  | 'unconfirmed-write';

export type OfflineDraftSyncDecision =
  { kind: 'blocked'; reason: OfflineDraftBlockReason } | { kind: 'requires-confirmation' };

/** Runtime guards remain fail-closed when untrusted persistence data bypasses TS checks. */
function isNonblankIdentifier(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= 128 &&
    value.trim().length > 0 &&
    value === value.trim()
  );
}

function isValidRevision(value: unknown): value is string {
  // Revision tokens remain opaque. Only require a bounded, nonempty exact value.
  return isNonblankIdentifier(value);
}

export function evaluateOfflineDraftSync(input: {
  draftOwnerId: string;
  authenticatedUserId: string | null;
  sessionVerified: boolean;
  online: boolean;
  baseRevision: string | null;
  remoteRevision: string | null;
  previousWriteUnconfirmed: boolean;
}): OfflineDraftSyncDecision {
  if (input.sessionVerified !== true || !isNonblankIdentifier(input.authenticatedUserId)) {
    return { kind: 'blocked', reason: 'unverified-session' };
  }
  if (
    !isNonblankIdentifier(input.draftOwnerId) ||
    input.draftOwnerId !== input.authenticatedUserId
  ) {
    return { kind: 'blocked', reason: 'wrong-account' };
  }
  if (input.online !== true) {
    return { kind: 'blocked', reason: 'offline' };
  }
  // Unknown write outcomes must fail closed just like a confirmed lost response.
  if (input.previousWriteUnconfirmed !== false) {
    return { kind: 'blocked', reason: 'unconfirmed-write' };
  }
  if (!isValidRevision(input.baseRevision) || !isValidRevision(input.remoteRevision)) {
    return { kind: 'blocked', reason: 'missing-revision' };
  }
  if (input.baseRevision !== input.remoteRevision) {
    return { kind: 'blocked', reason: 'remote-conflict' };
  }
  return { kind: 'requires-confirmation' };
}
