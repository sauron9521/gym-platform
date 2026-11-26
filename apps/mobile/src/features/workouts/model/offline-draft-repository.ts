import { z } from 'zod';

import type { MobileMultiWorkoutForm } from '../lib/create-workout-schema';
import { createOfflineWorkoutDraft, parseOwnedWorkoutDraft } from '../lib/offline-workout-draft';

/**
 * Persistence port, NOT an encryption implementation. Only an audited encrypted
 * native adapter may implement this for production. No browser/plaintext fallback.
 */
export interface OfflineDraftStorage {
  read(ownerId: string): Promise<string | null>;
  write(ownerId: string, serialized: string): Promise<void>;
  remove(ownerId: string): Promise<void>;
}

type DraftErrorCode = 'locked' | 'cleanup-required' | 'invalid-draft' | 'storage-failed';

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

  async load() {
    const scope = this.scope();
    return this.enqueue(async () => {
      this.assertCurrent(scope);
      const serialized = await this.accessStorage(() => this.storage.read(scope.ownerId));
      this.assertCurrent(scope);
      if (serialized === null) return null;
      const draft = parseOwnedWorkoutDraft(serialized, scope.ownerId);
      if (!draft) throw new OfflineDraftRepositoryError('invalid-draft');
      return draft;
    });
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
      this.assertCurrent(scope);
      await this.accessStorage(() => this.storage.write(scope.ownerId, serialized));
      this.assertCurrent(scope);
    });
  }

  /** Remove only the current verified owner's draft after explicit discard. */
  async discard() {
    const scope = this.scope();
    return this.enqueue(async () => {
      this.assertCurrent(scope);
      await this.accessStorage(() => this.storage.remove(scope.ownerId));
      this.assertCurrent(scope);
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
