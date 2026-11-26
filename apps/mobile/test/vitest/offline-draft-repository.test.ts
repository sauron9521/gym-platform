import { describe, expect, it, vi } from 'vitest';
import {
  OfflineDraftRepository,
  type OfflineDraftStorage,
} from '@/features/workouts/model/offline-draft-repository';
import { createOfflineWorkoutDraft } from '@/features/workouts/lib/offline-workout-draft';

const ownerA = '11111111-1111-4111-8111-111111111111';
const ownerB = '22222222-2222-4222-8222-222222222222';
const form = {
  title: 'Workout',
  exercises: [{ exerciseId: ownerA, sets: [{ reps: '10', weightKg: '50' }] }],
};

function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

// Fake in-memory adapter only. These tests do not prove encryption or device durability.
function harness() {
  const records = new Map<string, string>();
  const storage = {
    read: vi.fn(async (ownerId: string) => records.get(ownerId) ?? null),
    write: vi.fn(async (ownerId: string, value: string) => {
      records.set(ownerId, value);
    }),
    remove: vi.fn(async (ownerId: string) => {
      records.delete(ownerId);
    }),
  } satisfies OfflineDraftStorage;
  return { storage, records, repository: new OfflineDraftRepository(storage) };
}

describe('offline draft repository boundary', () => {
  it('does not touch storage until explicitly unlocked for a valid owner', async () => {
    const { repository, storage } = harness();
    await expect(repository.load()).rejects.toMatchObject({ code: 'locked' });
    await expect(repository.save(form)).rejects.toMatchObject({ code: 'locked' });
    expect(() => repository.unlockVerifiedOwner('invalid')).toThrow('locked');
    expect(storage.read).not.toHaveBeenCalled();
    expect(storage.write).not.toHaveBeenCalled();
  });

  it('round-trips the versioned review-only envelope through a replacement instance', async () => {
    const { repository, storage } = harness();
    repository.unlockVerifiedOwner(ownerA);
    expect(await repository.load()).toBeNull();
    await repository.save(form, 123);
    const reopened = new OfflineDraftRepository(storage);
    reopened.unlockVerifiedOwner(ownerA);
    expect(await reopened.load()).toEqual(createOfflineWorkoutDraft(ownerA, form, 123));
  });

  it.each([
    'not JSON',
    JSON.stringify({ ...createOfflineWorkoutDraft(ownerA, form), schemaVersion: 2 }),
    JSON.stringify(createOfflineWorkoutDraft(ownerB, form)),
    'x'.repeat(1_000_001),
  ])('rejects untrusted persisted values', async (raw) => {
    const { repository, records, storage } = harness();
    repository.unlockVerifiedOwner(ownerA);
    records.set(ownerA, raw);
    await expect(repository.load()).rejects.toMatchObject({ code: 'invalid-draft' });
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it('rejects invalid input without writing or leaking form details', async () => {
    const { repository, storage } = harness();
    repository.unlockVerifiedOwner(ownerA);
    await expect(repository.save({ ...form, title: '' })).rejects.toMatchObject({
      code: 'invalid-draft',
    });
    expect(storage.write).not.toHaveBeenCalled();
  });

  it('does not expose an old read after locking and reopening the same account', async () => {
    const { repository, storage } = harness();
    repository.unlockVerifiedOwner(ownerA);
    const started = deferred();
    const finish = deferred();
    storage.read.mockImplementationOnce(async () => {
      started.resolve();
      await finish.promise;
      return JSON.stringify(createOfflineWorkoutDraft(ownerA, form));
    });
    const read = repository.load();
    const rejected = expect(read).rejects.toMatchObject({ code: 'locked' });
    await started.promise;
    repository.lock();
    repository.unlockVerifiedOwner(ownerA);
    finish.resolve();
    await rejected;
  });

  it('purges after an in-flight write, prevents queued writes and isolates the next account', async () => {
    const { repository, storage, records } = harness();
    repository.unlockVerifiedOwner(ownerA);
    const started = deferred();
    const finish = deferred();
    storage.write.mockImplementationOnce(async (id, value) => {
      started.resolve();
      await finish.promise;
      records.set(id, value);
    });
    const first = repository.save(form);
    const firstRejected = expect(first).rejects.toMatchObject({ code: 'locked' });
    await started.promise;
    const queued = repository.save({ ...form, title: 'Another workout' });
    const queuedRejected = expect(queued).rejects.toMatchObject({ code: 'locked' });
    const purged = repository.purgeOwner();
    expect(() => repository.unlockVerifiedOwner(ownerB)).toThrow('cleanup-required');
    finish.resolve();
    await firstRejected;
    await queuedRejected;
    await purged;
    expect(storage.write).toHaveBeenCalledOnce();
    expect(records.has(ownerA)).toBe(false);
    repository.unlockVerifiedOwner(ownerB);
    expect(await repository.load()).toBeNull();
  });

  it('keeps account switching locked after deletion failure until explicit successful cleanup', async () => {
    const { repository, storage } = harness();
    repository.unlockVerifiedOwner(ownerA);
    await repository.save(form);
    storage.remove.mockRejectedValueOnce(new Error('private database details'));
    await expect(repository.purgeOwner()).rejects.toMatchObject({
      code: 'storage-failed',
      message: 'storage-failed',
    });
    expect(() => repository.unlockVerifiedOwner(ownerA)).toThrow('cleanup-required');
    expect(() => repository.unlockVerifiedOwner(ownerB)).toThrow('cleanup-required');
    await repository.purgeOwner();
    repository.unlockVerifiedOwner(ownerB);
    expect(await repository.load()).toBeNull();
  });

  it('serializes writes, survives storage failures and explicitly discards only its owner', async () => {
    const { repository, storage, records } = harness();
    repository.unlockVerifiedOwner(ownerA);
    records.set(ownerB, 'untouched');
    storage.write.mockRejectedValueOnce(new Error('private contents'));
    await expect(repository.save(form)).rejects.toMatchObject({
      code: 'storage-failed',
      message: 'storage-failed',
    });
    await Promise.all([repository.save(form, 1), repository.save({ ...form, title: 'Latest' }, 2)]);
    expect((await repository.load())?.form.title).toBe('Latest');
    await repository.discard();
    expect(await repository.load()).toBeNull();
    expect(records.get(ownerB)).toBe('untouched');
  });
});
