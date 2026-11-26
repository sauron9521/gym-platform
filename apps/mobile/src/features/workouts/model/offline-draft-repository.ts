import { z } from 'zod';

import type { MobileMultiWorkoutForm } from '../lib/create-workout-schema';
import {
  createOfflineWorkoutDraft,
  parseOwnedWorkoutDraft,
  draftBodyJson,
  reserveWorkoutDraft,
  type PendingWorkoutDraft,
  type AcknowledgedWorkoutDraft,
  type PersistedWorkoutDraft,
} from '../lib/offline-workout-draft';

/**
 * Persistence port, NOT an encryption implementation. Only an audited encrypted
 * native adapter may implement this for production. No browser/plaintext fallback.
 */
export interface OfflineDraftStorage {
  read(ownerId: string): Promise<string | null>;
  write(ownerId: string, serialized: string): Promise<void>;
  remove(ownerId: string): Promise<void>;
}

type DraftErrorCode =
  | 'locked'
  | 'cleanup-required'
  | 'invalid-draft'
  | 'storage-failed'
  | 'submission-pending'
  | 'submission-mismatch'
  | 'review-required';

export class OfflineDraftRepositoryError extends Error {
  constructor(readonly code: DraftErrorCode) {
    super(code);
    this.name = 'OfflineDraftRepositoryError';
  }
}

/**
 * One instance per application. The caller must unlock only after server-verified
 * athlete access, lock on background/revocation, and await purge on logout/switch.
 * The future native adapter owns durable encryption, migrations and crash cleanup.
 */
export class OfflineDraftRepository {
  private ownerId: string | null = null;
  private generation = 0;
  private unlocked = false;
  private cleanupRequired = false;
  private acknowledgedCleanup: {
    ownerId: string;
    generation: number;
    key: string;
    workoutId: string;
  } | null = null;
  private purgeInFlight: Promise<void> | null = null;
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly storage: OfflineDraftStorage) {}

  unlockVerifiedOwner(ownerId: string) {
    if (!z.uuid().safeParse(ownerId).success) throw new OfflineDraftRepositoryError('locked');
    if (this.cleanupRequired || (this.ownerId !== null && this.ownerId !== ownerId)) {
      throw new OfflineDraftRepositoryError('cleanup-required');
    }
    this.ownerId = ownerId;
    this.unlocked = true;
    this.generation += 1;
  }

  lock() {
    this.unlocked = false;
    this.acknowledgedCleanup = null;
    this.generation += 1;
  }

  private scope() {
    if (!this.unlocked || !this.ownerId) throw new OfflineDraftRepositoryError('locked');
    return { ownerId: this.ownerId, generation: this.generation };
  }

  private assertCurrent(scope: { ownerId: string; generation: number }) {
    if (!this.unlocked || this.ownerId !== scope.ownerId || this.generation !== scope.generation) {
      throw new OfflineDraftRepositoryError('locked');
    }
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation);
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private async accessStorage<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch {
      // Do not expose raw database errors, paths, values or key material.
      throw new OfflineDraftRepositoryError('storage-failed');
    }
  }

  private async readCurrent(scope: { ownerId: string; generation: number }) {
    this.assertCurrent(scope);
    const serialized = await this.accessStorage(() => this.storage.read(scope.ownerId));
    this.assertCurrent(scope);
    if (serialized === null) return null;
    const draft = parseOwnedWorkoutDraft(serialized, scope.ownerId);
    if (!draft) throw new OfflineDraftRepositoryError('invalid-draft');
    return draft;
  }

  private async persistAndVerify(
    scope: { ownerId: string; generation: number },
    record: PersistedWorkoutDraft,
  ) {
    const serialized = JSON.stringify(record);
    const expected = parseOwnedWorkoutDraft(serialized, scope.ownerId);
    if (!expected) {
      throw new OfflineDraftRepositoryError('invalid-draft');
    }
    this.assertCurrent(scope);
    await this.accessStorage(() => this.storage.write(scope.ownerId, serialized));
    this.assertCurrent(scope);
    const confirmed = await this.readCurrent(scope);
    if (JSON.stringify(confirmed) !== JSON.stringify(expected))
      throw new OfflineDraftRepositoryError('storage-failed');
  }

  async load() {
    const scope = this.scope();
    return this.enqueue(() => this.readCurrent(scope));
  }

  async save(form: MobileMultiWorkoutForm, now = Date.now()) {
    const scope = this.scope();
    let serialized: string;
    try {
      serialized = JSON.stringify(createOfflineWorkoutDraft(scope.ownerId, form, now));
      if (!parseOwnedWorkoutDraft(serialized, scope.ownerId)) throw new Error('invalid-draft');
    } catch {
      throw new OfflineDraftRepositoryError('invalid-draft');
    }
    return this.enqueue(async () => {
      if (this.acknowledgedCleanup) throw new OfflineDraftRepositoryError('submission-pending');
      const existing = await this.readCurrent(scope);
      if (existing && existing.state !== 'REQUIRES_REVIEW') {
        throw new OfflineDraftRepositoryError('submission-pending');
      }
      this.assertCurrent(scope);
      await this.accessStorage(() => this.storage.write(scope.ownerId, serialized));
      this.assertCurrent(scope);
    });
  }

  /** Remove only the current verified owner's draft after explicit discard. */
  async discard() {
    const scope = this.scope();
    return this.enqueue(async () => {
      if (this.acknowledgedCleanup) throw new OfflineDraftRepositoryError('submission-pending');
      const existing = await this.readCurrent(scope);
      if (existing && existing.state !== 'REQUIRES_REVIEW') {
        throw new OfflineDraftRepositoryError('submission-pending');
      }
      this.assertCurrent(scope);
      await this.accessStorage(() => this.storage.remove(scope.ownerId));
      this.assertCurrent(scope);
    });
  }

  /**
   * Reserve a durable key BEFORE a caller may send. This is local-only.
   * Reopening an uncertain attempt returns the exact previous request.
   * The network layer must still verify current authorization/connectivity
   * and require a new explicit confirmation for each send.
   */
  async reserveReviewedSubmission(
    form: MobileMultiWorkoutForm,
    review: { online: boolean; explicitlyConfirmed: boolean },
    createKey: () => string,
  ): Promise<PendingWorkoutDraft> {
    const scope = this.scope();
    if (review.online !== true || review.explicitlyConfirmed !== true) {
      throw new OfflineDraftRepositoryError('review-required');
    }
    let bodyJson: string;
    try {
      bodyJson = draftBodyJson(form);
    } catch {
      throw new OfflineDraftRepositoryError('invalid-draft');
    }
    return this.enqueue(async () => {
      if (this.acknowledgedCleanup) throw new OfflineDraftRepositoryError('submission-pending');
      const existing = await this.readCurrent(scope);
      if (!existing || draftBodyJson(existing.form) !== bodyJson) {
        throw new OfflineDraftRepositoryError('submission-mismatch');
      }
      if (existing.state === 'SUBMISSION_ACKNOWLEDGED') {
        throw new OfflineDraftRepositoryError('submission-pending');
      }
      this.assertCurrent(scope);
      if (existing.state === 'SUBMISSION_PENDING') return existing;
      let pending: PendingWorkoutDraft;
      try {
        pending = reserveWorkoutDraft(existing, createKey());
      } catch {
        throw new OfflineDraftRepositoryError('invalid-draft');
      }
      await this.persistAndVerify(scope, pending);
      return pending;
    });
  }

  /** Trusted caller supplies the validated 201 receipt for this exact key. */
  async acknowledgeSubmission(key: string, workoutId: string): Promise<AcknowledgedWorkoutDraft> {
    const scope = this.scope();
    if (!z.uuid().safeParse(workoutId).success)
      throw new OfflineDraftRepositoryError('invalid-draft');
    return this.enqueue(async () => {
      const existing = await this.readCurrent(scope);
      if (!existing || existing.state === 'REQUIRES_REVIEW' || existing.key !== key) {
        throw new OfflineDraftRepositoryError('submission-mismatch');
      }
      this.assertCurrent(scope);
      if (existing.state === 'SUBMISSION_ACKNOWLEDGED') {
        if (existing.workoutId !== workoutId)
          throw new OfflineDraftRepositoryError('submission-mismatch');
        return existing;
      }
      const acknowledged: AcknowledgedWorkoutDraft = {
        ...existing,
        state: 'SUBMISSION_ACKNOWLEDGED',
        workoutId,
      };
      await this.persistAndVerify(scope, acknowledged);
      return acknowledged;
    });
  }

  /** Cleanup is separate so a failed removal never causes another POST. */
  async clearAcknowledgedSubmission(key: string, workoutId: string) {
    const scope = this.scope();
    return this.enqueue(async () => {
      const cleanup = this.acknowledgedCleanup;
      if (cleanup) {
        if (
          cleanup.ownerId !== scope.ownerId ||
          cleanup.generation !== scope.generation ||
          cleanup.key !== key ||
          cleanup.workoutId !== workoutId
        ) {
          throw new OfflineDraftRepositoryError('submission-mismatch');
        }
      } else {
        const existing = await this.readCurrent(scope);
        if (
          !existing ||
          existing.state !== 'SUBMISSION_ACKNOWLEDGED' ||
          existing.key !== key ||
          existing.workoutId !== workoutId
        ) {
          throw new OfflineDraftRepositoryError('submission-mismatch');
        }
        this.assertCurrent(scope);
        // Removal can erase the key before a filesystem failure. Retry only the
        // exact already-authorized cleanup, without needing to decrypt again.
        this.acknowledgedCleanup = { ...scope, key, workoutId };
      }
      this.assertCurrent(scope);
      await this.accessStorage(() => this.storage.remove(scope.ownerId));
      this.assertCurrent(scope);
      this.acknowledgedCleanup = null;
    });
  }

  /** Invalidate immediately; delete after any already-running write settles. */
  purgeOwner(): Promise<void> {
    if (this.purgeInFlight) return this.purgeInFlight;
    this.lock();
    const ownerId = this.ownerId;
    if (!ownerId) return Promise.resolve();
    this.cleanupRequired = true;
    this.purgeInFlight = this.enqueue(async () => {
      try {
        await this.accessStorage(() => this.storage.remove(ownerId));
        this.ownerId = null;
        this.cleanupRequired = false;
      } finally {
        this.purgeInFlight = null;
      }
    });
    return this.purgeInFlight;
  }
}
