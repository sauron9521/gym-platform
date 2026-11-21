import { describe, expect, it } from 'vitest';
import { evaluateOfflineDraftSync } from '../../src/features/workouts/lib/offline-draft-policy';

const ready = {
  draftOwnerId: 'athlete-A',
  authenticatedUserId: 'athlete-A',
  sessionVerified: true,
  online: true,
  baseRevision: 'v3',
  remoteRevision: 'v3',
  previousWriteUnconfirmed: false,
};

describe('offline draft write safety', () => {
  it('never automatically syncs even if remote revision matches', () => {
    expect(evaluateOfflineDraftSync(ready)).toEqual({ kind: 'requires-confirmation' });
  });

  it('does not mistake an unconfirmed user decision for an authorized write', () => {
    const decision = evaluateOfflineDraftSync(ready);
    expect(decision.kind).toBe('requires-confirmation');
    expect(decision).not.toHaveProperty('authorized');
  });

  it.each([
    [{ authenticatedUserId: null }, 'unverified-session'],
    [{ authenticatedUserId: '' }, 'unverified-session'],
    [{ authenticatedUserId: '   ' }, 'unverified-session'],
    [{ authenticatedUserId: 7 }, 'unverified-session'],
    [{ sessionVerified: undefined }, 'unverified-session'],
    [{ sessionVerified: 'true' }, 'unverified-session'],
    [{ sessionVerified: false }, 'unverified-session'],
    [{ authenticatedUserId: 'athlete-B' }, 'wrong-account'],
    [{ draftOwnerId: '' }, 'wrong-account'],
    [{ draftOwnerId: ' athlete-A ' }, 'wrong-account'],
    [{ online: false }, 'offline'],
    [{ online: undefined }, 'offline'],
    [{ online: 'true' }, 'offline'],
    [{ baseRevision: null }, 'missing-revision'],
    [{ baseRevision: '' }, 'missing-revision'],
    [{ baseRevision: ' ' }, 'missing-revision'],
    [{ baseRevision: 'v'.repeat(129) }, 'missing-revision'],
    [{ baseRevision: 3 }, 'missing-revision'],
    [{ remoteRevision: null }, 'missing-revision'],
    [{ remoteRevision: '  ' }, 'missing-revision'],
    [{ remoteRevision: 'v4' }, 'remote-conflict'],
    [{ previousWriteUnconfirmed: true }, 'unconfirmed-write'],
    [{ previousWriteUnconfirmed: undefined }, 'unconfirmed-write'],
    [{ previousWriteUnconfirmed: 'false' }, 'unconfirmed-write'],
  ] as const)('fails closed for %s', (changes, reason) => {
    // Deliberately simulate untyped/untrusted persisted data at the runtime boundary.
    const untrusted = { ...ready, ...changes } as unknown as Parameters<
      typeof evaluateOfflineDraftSync
    >[0];
    expect(evaluateOfflineDraftSync(untrusted)).toEqual({
      kind: 'blocked',
      reason,
    });
  });
});
