import { describe, expect, it, vi } from 'vitest';
import {
  OfflineDraftRepository,
  type OfflineDraftStorage,
} from '@/features/workouts/model/offline-draft-repository';
import {
  createOfflineWorkoutDraft,
  draftBodyJson,
} from '@/features/workouts/lib/offline-workout-draft';

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

const key = 'draft-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherKey = 'draft-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const workoutId = '33333333-3333-4333-8333-333333333333';
const review = { online: true, explicitlyConfirmed: true };

describe('durable reviewed submission reservation', () => {
  async function prepared() {
    const h = harness();
    h.repository.unlockVerifiedOwner(ownerA);
    await h.repository.save(form, 123);
    return h;
  }

  it('reserves exactly one key before returning the frozen body and reuses it across process restart', async () => {
    const { repository, records, storage } = await prepared();
    const createKey = vi.fn(() => key);
    const first = await repository.reserveReviewedSubmission(form, review, createKey);
    expect(first.state).toBe('SUBMISSION_PENDING');
    expect(first.bodyJson).toBe(draftBodyJson(form));
    expect(JSON.parse(records.get(ownerA)!)).toEqual(first);
    const reopened = new OfflineDraftRepository(storage);
    reopened.unlockVerifiedOwner(ownerA);
    const retry = await reopened.reserveReviewedSubmission(form, review, () => otherKey);
    expect(retry).toEqual(first);
    expect(createKey).toHaveBeenCalledOnce();
    expect(storage.write).toHaveBeenCalledTimes(2);
  });

  it('requires an exact saved request, explicit review and online state on every reservation', async () => {
    const { repository, storage } = await prepared();
    const createKey = vi.fn(() => key);
    await expect(
      repository.reserveReviewedSubmission(form, { ...review, online: false }, createKey),
    ).rejects.toMatchObject({ code: 'review-required' });
    await expect(
      repository.reserveReviewedSubmission(
        form,
        { ...review, explicitlyConfirmed: false },
        createKey,
      ),
    ).rejects.toMatchObject({ code: 'review-required' });
    await expect(
      repository.reserveReviewedSubmission({ ...form, title: 'Changed' }, review, createKey),
    ).rejects.toMatchObject({ code: 'submission-mismatch' });
    expect(createKey).not.toHaveBeenCalled();
    expect(storage.write).toHaveBeenCalledOnce();
    await repository.reserveReviewedSubmission(form, review, createKey);
    await expect(
      repository.reserveReviewedSubmission({ ...form, title: 'Changed' }, review, createKey),
    ).rejects.toMatchObject({ code: 'submission-mismatch' });
    await expect(
      repository.reserveReviewedSubmission(
        form,
        { ...review, explicitlyConfirmed: false },
        createKey,
      ),
    ).rejects.toMatchObject({ code: 'review-required' });
  });

  it('serializes concurrent reservations and prohibits overwriting or discarding a pending attempt', async () => {
    const { repository, storage } = await prepared();
    const attempts = await Promise.all([
      repository.reserveReviewedSubmission(form, review, () => key),
      repository.reserveReviewedSubmission(form, review, () => otherKey),
    ]);
    expect(attempts[0]).toEqual(attempts[1]);
    await expect(repository.save(form)).rejects.toMatchObject({ code: 'submission-pending' });
    await expect(repository.discard()).rejects.toMatchObject({ code: 'submission-pending' });
    await expect(repository.clearAcknowledgedSubmission(key, workoutId)).rejects.toMatchObject({
      code: 'submission-mismatch',
    });
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it('never returns a sendable attempt if a write fails, but reuses a committed uncertain reservation', async () => {
    const { repository, records, storage } = await prepared();
    storage.write.mockImplementationOnce(async (id, value) => {
      records.set(id, value);
      throw new Error('private native failure');
    });
    await expect(
      repository.reserveReviewedSubmission(form, review, () => key),
    ).rejects.toMatchObject({ code: 'storage-failed' });
    const reopened = new OfflineDraftRepository(storage);
    reopened.unlockVerifiedOwner(ownerA);
    expect((await reopened.reserveReviewedSubmission(form, review, () => otherKey)).key).toBe(key);
    expect(storage.write).toHaveBeenCalledTimes(2);
  });

  it('does not return an attempt when its storage write was not confirmed by a read', async () => {
    const { repository, storage } = await prepared();
    storage.write.mockResolvedValueOnce(undefined);
    await expect(
      repository.reserveReviewedSubmission(form, review, () => key),
    ).rejects.toMatchObject({ code: 'storage-failed' });
    expect((await repository.load())?.state).toBe('REQUIRES_REVIEW');
  });

  it('invalidates an in-flight reservation on background lock and recovers the same committed key later', async () => {
    const { repository, records, storage } = await prepared();
    const started = deferred();
    const finish = deferred();
    storage.write.mockImplementationOnce(async (id, value) => {
      started.resolve();
      await finish.promise;
      records.set(id, value);
    });
    const reservation = repository.reserveReviewedSubmission(form, review, () => key);
    const rejected = expect(reservation).rejects.toMatchObject({ code: 'locked' });
    await started.promise;
    repository.lock();
    finish.resolve();
    await rejected;
    repository.unlockVerifiedOwner(ownerA);
    expect((await repository.reserveReviewedSubmission(form, review, () => otherKey)).key).toBe(
      key,
    );
  });

  it('persists a matching validated receipt before cleanup and never permits resend after acknowledgment', async () => {
    const { repository, storage } = await prepared();
    await repository.reserveReviewedSubmission(form, review, () => key);
    await expect(repository.acknowledgeSubmission(otherKey, workoutId)).rejects.toMatchObject({
      code: 'submission-mismatch',
    });
    await expect(repository.acknowledgeSubmission(key, 'invalid')).rejects.toMatchObject({
      code: 'invalid-draft',
    });
    const receipt = await repository.acknowledgeSubmission(key, workoutId);
    expect(receipt).toMatchObject({ state: 'SUBMISSION_ACKNOWLEDGED', key, workoutId });
    storage.remove.mockRejectedValueOnce(new Error('cleanup failed'));
    await expect(repository.clearAcknowledgedSubmission(key, workoutId)).rejects.toMatchObject({
      code: 'storage-failed',
    });
    const reopened = new OfflineDraftRepository(storage);
    reopened.unlockVerifiedOwner(ownerA);
    expect(await reopened.load()).toEqual(receipt);
    await expect(
      reopened.reserveReviewedSubmission(form, review, () => otherKey),
    ).rejects.toMatchObject({ code: 'submission-pending' });
    await expect(reopened.acknowledgeSubmission(key, ownerB)).rejects.toMatchObject({
      code: 'submission-mismatch',
    });
    expect(await reopened.acknowledgeSubmission(key, workoutId)).toEqual(receipt);
    await expect(reopened.clearAcknowledgedSubmission(otherKey, workoutId)).rejects.toMatchObject({
      code: 'submission-mismatch',
    });
    await reopened.clearAcknowledgedSubmission(key, workoutId);
    expect(await reopened.load()).toBeNull();
  });

  it('does not expose, overwrite or discard a tampered pending record', async () => {
    const { repository, records, storage } = await prepared();
    const pending = await repository.reserveReviewedSubmission(form, review, () => key);
    records.set(ownerA, JSON.stringify({ ...pending, bodyJson: '{}' }));
    await expect(repository.load()).rejects.toMatchObject({ code: 'invalid-draft' });
    await expect(
      repository.reserveReviewedSubmission(form, review, () => otherKey),
    ).rejects.toMatchObject({ code: 'invalid-draft' });
    await expect(repository.save(form)).rejects.toMatchObject({ code: 'invalid-draft' });
    await expect(repository.discard()).rejects.toMatchObject({ code: 'invalid-draft' });
    expect(storage.remove).not.toHaveBeenCalled();
    expect(storage.write).toHaveBeenCalledTimes(2);
  });
});
