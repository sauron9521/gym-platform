import { AppState } from 'react-native';
import { z } from 'zod';
import {
  hasAthleteAccess,
  type AccountCapabilities,
} from '@/features/auth/model/account-capabilities';
import type { PrivateDataLifecycle } from '@/features/auth/model/private-data-lifecycle';
import type { PendingWorkoutDraft } from '../lib/offline-workout-draft';
import type { MobileMultiWorkoutForm } from '../lib/create-workout-schema';
import type { EncryptedOfflineDraftStorage } from './encrypted-draft-storage';
import { OfflineDraftRepository } from './offline-draft-repository';

export type DraftLifecycleState =
  'locked' | 'preparing' | 'ready' | 'unavailable' | 'cleanup-required';

/** One coordinator per application. Never open drafts from an unverified session. */
export class OfflineDraftLifecycle implements PrivateDataLifecycle {
  private readonly repository: OfflineDraftRepository;
  private queue: Promise<void> = Promise.resolve();
  private generation = 0;
  private repositoryOwner: string | null = null;
  private cleanupRequired = false;
  private sending = false;
  private clearing = false;
  private cleanupReceipt: {
    ownerId: string;
    generation: number;
    key: string;
    workoutId: string;
  } | null = null;
  private state: DraftLifecycleState = 'locked';
  private snapshot = { status: this.state as DraftLifecycleState, generation: 0 };
  private readonly listeners = new Set<() => void>();

  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private publish(status: DraftLifecycleState) {
    this.state = status;
    this.snapshot = { status, generation: this.generation };
    for (const listener of this.listeners) listener();
  }

  constructor(
    private readonly storage: EncryptedOfflineDraftStorage,
    private readonly isForeground: () => boolean = () => true,
  ) {
    this.repository = new OfflineDraftRepository(storage);
  }

  get status() {
    return this.state;
  }

  lock() {
    ++this.generation;
    this.cleanupReceipt = null;
    this.repository.lock();
    this.publish(this.cleanupRequired ? 'cleanup-required' : 'locked');
  }

  private enqueue(operation: () => Promise<void>) {
    const result = this.queue.then(operation);
    this.queue = result.catch(() => undefined);
    return result;
  }

  private async cleanup() {
    this.cleanupRequired = true;
    await this.repository.purgeOwner();
    this.repositoryOwner = null;
    // Also clean an owner left by a previous process, even when the repository
    // never unlocked in this process.
    await this.storage.purgePersistedOwner();
    this.cleanupRequired = false;
  }

  verified(ownerId: string, capabilities: AccountCapabilities) {
    if (!hasAthleteAccess(capabilities)) return this.end();
    this.lock();
    const generation = this.generation;
    if (!this.isForeground()) return Promise.resolve();
    if (!this.cleanupRequired) this.publish('preparing');
    return this.enqueue(async () => {
      if (generation !== this.generation) return;
      try {
        if (this.cleanupRequired) {
          this.publish('cleanup-required');
          return;
        }
        if (this.repositoryOwner && this.repositoryOwner !== ownerId) {
          await this.cleanup();
        }
        if (generation !== this.generation) return;
        await this.storage.prepareVerifiedOwner(ownerId);
        if (generation !== this.generation) return;
        if (!this.isForeground()) {
          this.lock();
          return;
        }
        this.repository.unlockVerifiedOwner(ownerId);
        this.repositoryOwner = ownerId;
        this.publish('ready');
      } catch {
        this.repository.lock();
        if (generation === this.generation) {
          this.publish(this.cleanupRequired ? 'cleanup-required' : 'unavailable');
        }
      }
    });
  }

  /** End is never skipped, even when a newer verification is already queued. */
  end() {
    this.lock();
    const generation = this.generation;
    this.cleanupRequired = true;
    this.publish('cleanup-required');
    return this.enqueue(async () => {
      try {
        await this.cleanup();
        if (generation === this.generation) this.publish('locked');
      } catch {
        if (generation === this.generation) this.publish('cleanup-required');
      }
    });
  }

  isCurrentOwner(ownerId: string, generation: number) {
    return (
      this.state === 'ready' &&
      this.generation === generation &&
      this.repositoryOwner === ownerId &&
      this.isForeground()
    );
  }

  /** Explicit, one-at-a-time send. Never queue a network retry. */
  async submitReviewed(options: {
    ownerId: string;
    generation: number;
    form: MobileMultiWorkoutForm;
    explicitlyConfirmed: boolean;
    isOnline: () => boolean;
    createKey: () => string;
    send: (attempt: PendingWorkoutDraft, isCurrent: () => boolean) => Promise<unknown>;
  }) {
    const { ownerId, generation, form, explicitlyConfirmed, isOnline, createKey, send } = options;
    const isCurrent = () => this.isCurrentOwner(ownerId, generation);
    const canSend = () => isCurrent() && isOnline() === true;
    if (
      this.sending ||
      this.clearing ||
      this.cleanupReceipt ||
      !canSend() ||
      explicitlyConfirmed !== true
    )
      throw new Error('draft-send-blocked');
    this.sending = true;
    try {
      const pending = await this.repository.reserveReviewedSubmission(
        form,
        { online: isOnline(), explicitlyConfirmed },
        createKey,
      );
      if (!canSend() || pending.ownerId !== ownerId) throw new Error('draft-send-blocked');
      const result = await send(pending, canSend);
      if (!isCurrent()) throw new Error('draft-send-blocked');
      const receipt = z.object({ id: z.uuid(), athleteId: z.literal(ownerId) }).safeParse(result);
      if (!receipt.success) throw new Error('draft-receipt-invalid');
      return await this.repository.acknowledgeSubmission(pending.key, receipt.data.id);
    } finally {
      this.sending = false;
    }
  }

  async clearSubmitted(ownerId: string, generation: number) {
    if (this.sending || this.clearing || !this.isCurrentOwner(ownerId, generation)) {
      throw new Error('draft-send-blocked');
    }
    this.clearing = true;
    try {
      let receipt = this.cleanupReceipt;
      if (!receipt) {
        const record = await this.repository.load();
        if (
          !this.isCurrentOwner(ownerId, generation) ||
          record?.state !== 'SUBMISSION_ACKNOWLEDGED'
        ) {
          throw new Error('draft-receipt-invalid');
        }
        receipt = { ownerId, generation, key: record.key, workoutId: record.workoutId };
        this.cleanupReceipt = receipt;
      }
      if (
        receipt.ownerId !== ownerId ||
        receipt.generation !== generation ||
        !this.isCurrentOwner(ownerId, generation)
      )
        throw new Error('draft-send-blocked');
      await this.repository.clearAcknowledgedSubmission(receipt.key, receipt.workoutId);
      if (this.isCurrentOwner(ownerId, generation)) this.cleanupReceipt = null;
    } finally {
      this.clearing = false;
    }
  }

  load() {
    return this.repository.load();
  }

  save(form: MobileMultiWorkoutForm) {
    if (this.sending || this.clearing || this.cleanupReceipt)
      return Promise.reject(new Error('draft-send-blocked'));
    return this.repository.save(form);
  }

  discard() {
    if (this.sending || this.clearing || this.cleanupReceipt)
      return Promise.reject(new Error('draft-send-blocked'));
    return this.repository.discard();
  }
}

// Lazy native imports keep auth usable on old dev clients and Web even when
// SQLite is not installed/available. The coordinator fails closed, not auth.
const storage = async () =>
  (await import('./encrypted-draft-storage')).encryptedOfflineDraftStorage;
const lazyStorage: EncryptedOfflineDraftStorage = {
  read: async (ownerId) => (await storage()).read(ownerId),
  write: async (ownerId, value) => (await storage()).write(ownerId, value),
  remove: async (ownerId) => (await storage()).remove(ownerId),
  prepareVerifiedOwner: async (ownerId) => (await storage()).prepareVerifiedOwner(ownerId),
  purgePersistedOwner: async () => (await storage()).purgePersistedOwner(),
};

export const offlineDraftLifecycle = new OfflineDraftLifecycle(
  lazyStorage,
  () => AppState.currentState === 'active',
);
