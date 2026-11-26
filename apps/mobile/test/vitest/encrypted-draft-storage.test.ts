import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createOfflineWorkoutDraft } from '@/features/workouts/lib/offline-workout-draft';

const ownerA = '11111111-1111-4111-8111-111111111111';
const ownerB = '22222222-2222-4222-8222-222222222222';
const form = {
  title: 'Workout',
  exercises: [{ exerciseId: ownerA, sets: [{ reps: '10', weightKg: '50' }] }],
};
const draft = (ownerId = ownerA) => JSON.stringify(createOfflineWorkoutDraft(ownerId, form, 123));
const filename = 'ovranto-offline-draft-v1.db';
const uri = 'file:///private/SQLite/' + filename;

const mocks = vi.hoisted(() => ({
  random: vi.fn(),
  readMarker: vi.fn(),
  writeMarker: vi.fn(),
  deleteMarker: vi.fn(),
  stat: vi.fn(),
  deleteFile: vi.fn(),
  open: vi.fn(),
  query: vi.fn(),
  exec: vi.fn(),
  run: vi.fn(),
  close: vi.fn(),
}));

vi.mock('expo-crypto', () => ({ getRandomBytesAsync: mocks.random }));
vi.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only',
  getItemAsync: mocks.readMarker,
  setItemAsync: mocks.writeMarker,
  deleteItemAsync: mocks.deleteMarker,
}));
vi.mock('expo-file-system/legacy', () => ({
  getInfoAsync: mocks.stat,
  deleteAsync: mocks.deleteFile,
}));
vi.mock('expo-sqlite', () => ({
  defaultDatabaseDirectory: '/private/SQLite',
  openDatabaseAsync: mocks.open,
}));

let marker: string | null;
let files: Set<string>;
let version: number;
let row: { owner_id: string; payload: string } | null;
let cipher: boolean;
let wrongKey: boolean;

const restart = async () => {
  vi.resetModules();
  return (await import('@/features/workouts/model/encrypted-draft-storage'))
    .encryptedOfflineDraftStorage;
};

beforeEach(() => {
  vi.resetAllMocks();
  marker = null;
  files = new Set();
  version = 0;
  row = null;
  cipher = true;
  wrongKey = false;
  mocks.random.mockImplementation(async () => new Uint8Array(32).fill(171));
  mocks.readMarker.mockImplementation(async () => marker);
  mocks.writeMarker.mockImplementation(async (_key, value: string) => {
    marker = value;
  });
  mocks.deleteMarker.mockImplementation(async () => {
    marker = null;
  });
  mocks.stat.mockImplementation(async (path: string) => ({
    exists: files.has(path),
    isDirectory: false,
  }));
  mocks.deleteFile.mockImplementation(async (path: string) => {
    files.delete(path);
    if (path === uri) {
      row = null;
      version = 0;
    }
  });
  mocks.open.mockImplementation(async (name: string) => {
    if (name !== ':memory:') files.add(uri);
    return {
      getFirstAsync: mocks.query,
      execAsync: mocks.exec,
      runAsync: mocks.run,
      closeAsync: mocks.close,
    };
  });
  mocks.close.mockResolvedValue(undefined);
  mocks.exec.mockImplementation(async (sql: string) => {
    if (sql.includes('CREATE TABLE')) version = 1;
  });
  mocks.query.mockImplementation(async (sql: string, id?: string) => {
    if (sql === 'PRAGMA cipher_version') return cipher ? { cipher_version: '4.6.1' } : null;
    if (sql.includes('sqlite_master')) {
      if (wrongKey) throw new Error('private SQL with key');
      return { count: version === 0 ? 0 : 1 };
    }
    if (sql === 'PRAGMA journal_mode = DELETE') return { journal_mode: 'delete' };
    if (sql === 'PRAGMA user_version') return { user_version: version };
    if (sql.includes('SELECT owner_id')) return row && { owner_id: row.owner_id };
    if (sql.includes('SELECT payload'))
      return row && row.owner_id === id ? { payload: row.payload } : null;
    throw new Error('unexpected query');
  });
  mocks.run.mockImplementation(async (_sql, owner_id: string, payload: string) => {
    row = { owner_id, payload };
  });
});

describe('encrypted offline draft native adapter (mocked native modules)', () => {
  it('requires prepared owner and never touches storage for a different owner', async () => {
    const storage = await restart();
    await expect(storage.read(ownerA)).rejects.toThrow('encrypted-draft-storage-unavailable');
    await storage.prepareVerifiedOwner(ownerA);
    await expect(storage.write(ownerB, draft(ownerB))).rejects.toThrow(
      'encrypted-draft-storage-unavailable',
    );
    expect(mocks.run).not.toHaveBeenCalled();
    expect(mocks.random).not.toHaveBeenCalled();
  });

  it('rejects plain SQLite before opening a disk database or generating a key', async () => {
    cipher = false;
    const storage = await restart();
    await expect(storage.prepareVerifiedOwner(ownerA)).rejects.toThrow(
      'encrypted-draft-storage-unavailable',
    );
    expect(mocks.open.mock.calls.map(([name]) => name)).toEqual([':memory:']);
    expect(mocks.close).toHaveBeenCalledOnce();
    expect(mocks.writeMarker).not.toHaveBeenCalled();
    expect(files.size).toBe(0);
  });

  it('creates a secure owner marker before keyed schema initialization and reopens without generating a new key', async () => {
    const storage = await restart();
    await storage.prepareVerifiedOwner(ownerA);
    expect(await storage.read(ownerA)).toBeNull();
    await storage.write(ownerA, draft());
    expect(JSON.parse(marker!)).toEqual({
      version: 1,
      state: 'ready',
      ownerId: ownerA,
      key: 'ab'.repeat(32),
    });
    expect(mocks.writeMarker.mock.calls[0]?.[2]).toEqual({ keychainAccessible: 'device-only' });
    const diskOpen = mocks.open.mock.calls.findIndex(([name]) => name === filename);
    expect(mocks.writeMarker.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.open.mock.invocationCallOrder[diskOpen]!,
    );
    expect(mocks.exec.mock.calls[0]?.[0]).toBe(`PRAGMA key = "x'${'ab'.repeat(32)}'"`);
    expect(mocks.open.mock.calls[diskOpen]?.[1]).toEqual({
      useNewConnection: true,
      enableChangeListener: false,
    });
    expect(mocks.run.mock.calls[0]?.slice(1)).toEqual([ownerA, draft()]);
    const reopened = await restart();
    await reopened.prepareVerifiedOwner(ownerA);
    expect(await reopened.read(ownerA)).toBe(draft());
    expect(mocks.random).toHaveBeenCalledOnce();
  });

  it('does not create a key when the database exists but the secure marker is missing', async () => {
    files.add(uri);
    const storage = await restart();
    await expect(storage.prepareVerifiedOwner(ownerA)).rejects.toThrow(
      'encrypted-draft-storage-unavailable',
    );
    expect(mocks.random).not.toHaveBeenCalled();
    expect(mocks.open.mock.calls.map(([name]) => name)).toEqual([':memory:']);
    expect(files.has(uri)).toBe(true);
  });

  it('fails closed on wrong key, unknown schema or corrupt contents without replacing them', async () => {
    const storage = await restart();
    await storage.prepareVerifiedOwner(ownerA);
    await storage.write(ownerA, draft());
    wrongKey = true;
    await expect(storage.read(ownerA)).rejects.toThrow('encrypted-draft-storage-unavailable');
    wrongKey = false;
    version = 2;
    await expect(storage.write(ownerA, draft())).rejects.toThrow(
      'encrypted-draft-storage-unavailable',
    );
    version = 1;
    row = { owner_id: ownerA, payload: 'invalid' };
    await expect(storage.write(ownerA, draft())).rejects.toThrow(
      'encrypted-draft-storage-unavailable',
    );
    expect(mocks.run).toHaveBeenCalledOnce();
    expect(mocks.random).toHaveBeenCalledOnce();
    expect(mocks.deleteFile).not.toHaveBeenCalled();
  });

  it('rejects a foreign row and malformed marker', async () => {
    const storage = await restart();
    await storage.prepareVerifiedOwner(ownerA);
    await storage.write(ownerA, draft());
    row = { owner_id: ownerB, payload: draft(ownerB) };
    await expect(storage.read(ownerA)).rejects.toThrow('encrypted-draft-storage-unavailable');
    marker = '{bad';
    await expect(storage.prepareVerifiedOwner(ownerB)).rejects.toThrow(
      'encrypted-draft-storage-unavailable',
    );
    expect(mocks.deleteFile).not.toHaveBeenCalled();
  });

  it('resumes an interrupted provisioning with the same key', async () => {
    marker = JSON.stringify({
      version: 1,
      state: 'provisioning',
      ownerId: ownerA,
      key: '12'.repeat(32),
    });
    const storage = await restart();
    await storage.prepareVerifiedOwner(ownerA);
    await storage.write(ownerA, draft());
    expect(JSON.parse(marker!).state).toBe('ready');
    expect(JSON.parse(marker!).key).toBe('12'.repeat(32));
    expect(mocks.random).not.toHaveBeenCalled();
  });

  it('does not recreate a missing ready database', async () => {
    marker = JSON.stringify({ version: 1, state: 'ready', ownerId: ownerA, key: '12'.repeat(32) });
    const storage = await restart();
    await storage.prepareVerifiedOwner(ownerA);
    await expect(storage.read(ownerA)).rejects.toThrow('encrypted-draft-storage-unavailable');
    expect(files.size).toBe(0);
    expect(mocks.random).not.toHaveBeenCalled();
  });

  it('persists purge intent before deletion and resumes cleanup before admitting another owner', async () => {
    const storage = await restart();
    await storage.prepareVerifiedOwner(ownerA);
    await storage.write(ownerA, draft());
    files.add(uri + '-wal');
    files.add(uri + '-shm');
    mocks.deleteFile.mockRejectedValueOnce(new Error('private path'));
    await expect(storage.prepareVerifiedOwner(ownerB)).rejects.toThrow(
      'encrypted-draft-storage-unavailable',
    );
    expect(JSON.parse(marker!)).toEqual({ version: 1, state: 'purging', ownerId: ownerA });
    await expect(storage.read(ownerB)).rejects.toThrow('encrypted-draft-storage-unavailable');
    const reopened = await restart();
    await reopened.prepareVerifiedOwner(ownerB);
    expect(files.size).toBe(0);
    expect(marker).toBeNull();
    expect(await reopened.read(ownerB)).toBeNull();
    await reopened.write(ownerB, draft(ownerB));
    expect(JSON.parse(marker!).ownerId).toBe(ownerB);
  });

  it('supports cold-start logout cleanup without loading or decrypting drafts', async () => {
    const storage = await restart();
    await storage.prepareVerifiedOwner(ownerA);
    await storage.write(ownerA, draft());
    files.add(uri + '-journal');
    const reopened = await restart();
    mocks.open.mockClear();
    await reopened.purgePersistedOwner();
    expect(files.size).toBe(0);
    expect(marker).toBeNull();
    expect(mocks.open).not.toHaveBeenCalled();
  });

  it('blocks future access if a database connection could not be closed', async () => {
    const storage = await restart();
    mocks.close.mockRejectedValueOnce(new Error('close failed'));
    await expect(storage.prepareVerifiedOwner(ownerA)).rejects.toThrow(
      'encrypted-draft-storage-unavailable',
    );
    await expect(storage.prepareVerifiedOwner(ownerA)).rejects.toThrow(
      'encrypted-draft-storage-unavailable',
    );
    expect(mocks.open).toHaveBeenCalledOnce();
  });

  it('fails closed on web without native or browser persistence', async () => {
    const { encryptedOfflineDraftStorage: web } =
      await import('@/features/workouts/model/encrypted-draft-storage.web');
    await expect(web.prepareVerifiedOwner(ownerA)).rejects.toThrow(
      'encrypted-draft-storage-unavailable',
    );
    await expect(web.write(ownerA, draft())).rejects.toThrow('encrypted-draft-storage-unavailable');
    await expect(web.read(ownerA)).rejects.toThrow('encrypted-draft-storage-unavailable');
    expect(mocks.open).not.toHaveBeenCalled();
    expect(mocks.writeMarker).not.toHaveBeenCalled();
  });
});
