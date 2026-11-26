import { AppState } from 'react-native';
import {
  hasAthleteAccess,
  type AccountCapabilities,
} from '@/features/auth/model/account-capabilities';
import type { PrivateDataLifecycle } from '@/features/auth/model/private-data-lifecycle';
import type { MobileMultiWorkoutForm } from '../lib/create-workout-schema';
import type { EncryptedOfflineDraftStorage } from './encrypted-draft-storage';
import { OfflineDraftRepository } from './offline-draft-repository';

type LifecycleState = 'locked' | 'preparing' | 'ready' | 'unavailable' | 'cleanup-required';

/** One coordinator per application. Never open drafts from an unverified session. */
export class OfflineDraftLifecycle implements PrivateDataLifecycle {
  private readonly repository: OfflineDraftRepository;
  private queue: Promise<void> = Promise.resolve();
  private generation = 0;
  private repositoryOwner: string | null = null;
  private cleanupRequired = false;
  private state: LifecycleState = 'locked';

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
    this.repository.lock();
    this.state = this.cleanupRequired ? 'cleanup-required' : 'locked';
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
    if (!this.cleanupRequired) this.state = 'preparing';
    return this.enqueue(async () => {
      if (generation !== this.generation) return;
      try {
        if (this.cleanupRequired) {
          this.state = 'cleanup-required';
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
        this.state = 'ready';
      } catch {
        this.repository.lock();
        if (generation === this.generation) {
          this.state = this.cleanupRequired ? 'cleanup-required' : 'unavailable';
        }
      }
    });
  }

  /** End is never skipped, even when a newer verification is already queued. */
  end() {
    this.lock();
    const generation = this.generation;
    this.cleanupRequired = true;
    this.state = 'cleanup-required';
    return this.enqueue(async () => {
      try {
        await this.cleanup();
        if (generation === this.generation) this.state = 'locked';
      } catch {
        if (generation === this.generation) this.state = 'cleanup-required';
      }
    });
  }

  load() {
    return this.repository.load();
  }

  save(form: MobileMultiWorkoutForm) {
    return this.repository.save(form);
  }

  discard() {
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
