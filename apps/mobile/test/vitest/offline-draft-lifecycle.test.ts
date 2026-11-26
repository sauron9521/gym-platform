import { describe, expect, it, vi } from 'vitest';
import { OfflineDraftLifecycle } from '@/features/workouts/model/offline-draft-lifecycle';
import { createOfflineWorkoutDraft } from '@/features/workouts/lib/offline-workout-draft';
import type { EncryptedOfflineDraftStorage } from '@/features/workouts/model/encrypted-draft-storage';

const ownerA = '11111111-1111-4111-8111-111111111111';
const ownerB = '22222222-2222-4222-8222-222222222222';
const athlete = { athlete: true, trainer: false, admin: false };
const trainer = { athlete: false, trainer: true, admin: false };
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

function harness(isForeground = () => true) {
  const records = new Map<string, string>();
  const storage = {
    prepareVerifiedOwner: vi.fn(async (ownerId: string) => {
      for (const id of records.keys()) if (id !== ownerId) records.delete(id);
    }),
    purgePersistedOwner: vi.fn(async () => {
      records.clear();
    }),
    read: vi.fn(async (ownerId: string) => records.get(ownerId) ?? null),
    write: vi.fn(async (ownerId: string, serialized: string) => {
      records.set(ownerId, serialized);
    }),
    remove: vi.fn(async (ownerId: string) => {
      records.delete(ownerId);
    }),
  } satisfies EncryptedOfflineDraftStorage;
  const lifecycle = new OfflineDraftLifecycle(storage, isForeground);
  return { lifecycle, storage, records };
}

describe('offline draft auth lifecycle', () => {
  it('requires live athlete verification and retains encrypted data across a temporary lock', async () => {
    const { lifecycle, records, storage } = harness();
    await expect(lifecycle.load()).rejects.toMatchObject({ code: 'locked' });
    await lifecycle.verified(ownerA, athlete);
    expect(lifecycle.status).toBe('ready');
    await lifecycle.save(form);
    lifecycle.lock();
    expect(lifecycle.status).toBe('locked');
    await expect(lifecycle.load()).rejects.toMatchObject({ code: 'locked' });
    expect(records.has(ownerA)).toBe(true);
    expect(storage.remove).not.toHaveBeenCalled();
    await lifecycle.verified(ownerA, athlete);
    expect((await lifecycle.load())?.form).toEqual(form);
  });

  it('does not unlock after a late preparation completes following backgrounding', async () => {
    const { lifecycle, storage } = harness();
    const started = deferred();
    const finish = deferred();
    storage.prepareVerifiedOwner.mockImplementationOnce(async () => {
      started.resolve();
      await finish.promise;
    });
    const verified = lifecycle.verified(ownerA, athlete);
    await started.promise;
    lifecycle.lock();
    finish.resolve();
    await verified;
    expect(lifecycle.status).toBe('locked');
    await expect(lifecycle.load()).rejects.toMatchObject({ code: 'locked' });
  });

  it('cannot prepare or unlock in the background even if startup verification succeeds', async () => {
    let foreground = false;
    const { lifecycle, storage } = harness(() => foreground);
    await lifecycle.verified(ownerA, athlete);
    expect(lifecycle.status).toBe('locked');
    expect(storage.prepareVerifiedOwner).not.toHaveBeenCalled();
    foreground = true;
    const started = deferred();
    const finish = deferred();
    storage.prepareVerifiedOwner.mockImplementationOnce(async () => {
      started.resolve();
      await finish.promise;
    });
    const verified = lifecycle.verified(ownerA, athlete);
    await started.promise;
    foreground = false;
    finish.resolve();
    await verified;
    expect(lifecycle.status).toBe('locked');
  });

  it('locks immediately and purges after a running write before admitting a new account', async () => {
    const { lifecycle, storage, records } = harness();
    await lifecycle.verified(ownerA, athlete);
    const started = deferred();
    const finish = deferred();
    storage.write.mockImplementationOnce(async (id, value) => {
      started.resolve();
      await finish.promise;
      records.set(id, value);
    });
    const write = lifecycle.save(form);
    const rejected = expect(write).rejects.toMatchObject({ code: 'locked' });
    await started.promise;
    const ended = lifecycle.end();
    expect(lifecycle.status).toBe('cleanup-required');
    const newOwner = lifecycle.verified(ownerB, athlete);
    finish.resolve();
    await rejected;
    await ended;
    await newOwner;
    expect(records.has(ownerA)).toBe(false);
    expect(lifecycle.status).toBe('ready');
    expect(await lifecycle.load()).toBeNull();
  });

  it('blocks a new verification after failed cleanup until explicit end retries', async () => {
    const { lifecycle, storage, records } = harness();
    await lifecycle.verified(ownerA, athlete);
    await lifecycle.save(form);
    storage.remove.mockRejectedValueOnce(new Error('private native detail'));
    await lifecycle.end();
    expect(lifecycle.status).toBe('cleanup-required');
    await lifecycle.verified(ownerB, athlete);
    expect(lifecycle.status).toBe('cleanup-required');
    expect(storage.prepareVerifiedOwner).toHaveBeenCalledTimes(1);
    await expect(lifecycle.load()).rejects.toMatchObject({ code: 'locked' });
    await lifecycle.end();
    expect(records.has(ownerA)).toBe(false);
    await lifecycle.verified(ownerB, athlete);
    expect(lifecycle.status).toBe('ready');
  });

  it('cleans persisted drafts on cold-start logout and explicit loss of athlete access', async () => {
    const { lifecycle, storage, records } = harness();
    records.set(ownerA, JSON.stringify(createOfflineWorkoutDraft(ownerA, form)));
    await lifecycle.end();
    expect(records.size).toBe(0);
    expect(storage.purgePersistedOwner).toHaveBeenCalledOnce();
    await lifecycle.verified(ownerA, athlete);
    await lifecycle.save(form);
    await lifecycle.verified(ownerA, trainer);
    expect(lifecycle.status).toBe('locked');
    expect(records.size).toBe(0);
  });

  it('handles an unavailable adapter without failing authentication or exposing drafts', async () => {
    const { lifecycle, storage } = harness();
    storage.prepareVerifiedOwner.mockRejectedValueOnce(new Error('native SQL unavailable'));
    await expect(lifecycle.verified(ownerA, athlete)).resolves.toBeUndefined();
    expect(lifecycle.status).toBe('unavailable');
    await expect(lifecycle.load()).rejects.toMatchObject({ code: 'locked' });
  });

  it('cleans a previous owner before an account switch without an explicit logout', async () => {
    const { lifecycle, records, storage } = harness();
    await lifecycle.verified(ownerA, athlete);
    await lifecycle.save(form);
    await lifecycle.verified(ownerB, athlete);
    expect(storage.remove).toHaveBeenCalledWith(ownerA);
    expect(records.has(ownerA)).toBe(false);
    expect(lifecycle.status).toBe('ready');
    expect(await lifecycle.load()).toBeNull();
  });
});
