import { getRandomBytesAsync } from 'expo-crypto';
import { deleteAsync, getInfoAsync } from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import { defaultDatabaseDirectory, openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { z } from 'zod';

import { parseOwnedWorkoutDraft } from '../lib/offline-workout-draft';
import type { OfflineDraftStorage } from './offline-draft-repository';

const DATABASE = 'ovranto-offline-draft-v1.db';
const MARKER = 'gym-platform.offline-draft-owner.v1';
const KEY_OPTIONS = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const OPEN_OPTIONS = { useNewConnection: true, enableChangeListener: false };
const FILE_SUFFIXES = ['', '-journal', '-wal', '-shm'] as const;
const ownerSchema = z.uuid();
const markerSchema = z.discriminatedUnion('state', [
  z.strictObject({
    version: z.literal(1),
    state: z.enum(['provisioning', 'ready']),
    ownerId: ownerSchema,
    key: z.string().regex(/^[0-9a-f]{64}$/),
  }),
  z.strictObject({
    version: z.literal(1),
    state: z.literal('purging'),
    ownerId: ownerSchema,
  }),
]);
type Marker = z.infer<typeof markerSchema>;
type KeyMarker = Extract<Marker, { key: string }>;

export interface EncryptedOfflineDraftStorage extends OfflineDraftStorage {
  /** Call only after fresh athlete authorization; finish old-account cleanup first. */
  prepareVerifiedOwner(ownerId: string): Promise<void>;
  /** Cold-start/logout cleanup even when no repository owner is in memory. */
  purgePersistedOwner(): Promise<void>;
}

function fail(): never {
  throw new Error('encrypted-draft-storage-unavailable');
}

function databaseUri(suffix: (typeof FILE_SUFFIXES)[number]) {
  const directory: unknown = defaultDatabaseDirectory;
  if (typeof directory !== 'string' || !directory || !/^(file:\/\/\/|\/)/.test(directory)) fail();
  const base = directory.startsWith('file://') ? directory : `file://${directory}`;
  return `${base.replace(/\/+$/, '')}/${DATABASE}${suffix}`;
}

async function fileExists(suffix: (typeof FILE_SUFFIXES)[number]) {
  const info = await getInfoAsync(databaseUri(suffix));
  if (info.exists && info.isDirectory) fail();
  return info.exists;
}

async function anyDatabaseFiles() {
  for (const suffix of FILE_SUFFIXES) {
    if (await fileExists(suffix)) return true;
  }
  return false;
}

async function readMarker(): Promise<Marker | null> {
  const raw = await SecureStore.getItemAsync(MARKER, KEY_OPTIONS);
  if (raw === null) return null;
  if (raw.length > 512) fail();
  const parsed = markerSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) fail();
  return parsed.data;
}

async function writeMarker(marker: Marker) {
  await SecureStore.setItemAsync(MARKER, JSON.stringify(marker), KEY_OPTIONS);
}

async function assertCipher(db: SQLiteDatabase) {
  const result = await db.getFirstAsync<{ cipher_version: string }>('PRAGMA cipher_version');
  if (typeof result?.cipher_version !== 'string' || !result.cipher_version.trim()) fail();
}

/**
 * Single installation-local encrypted database; one verified owner at a time.
 * No plaintext fallback, no devtools registration, no retained open connection.
 * The future auth integration must serialize owner preparation with repository
 * unlock/purge and clear already-exposed UI state on capability loss.
 */
class NativeEncryptedDraftStorage implements EncryptedOfflineDraftStorage {
  private queue: Promise<void> = Promise.resolve();
  private connectionUnsafe = false;
  private preparedOwner: string | null = null;

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(async () => {
      if (this.connectionUnsafe) fail();
      try {
        return await operation();
      } catch {
        // Never propagate native SQL errors (they may contain key/payload text).
        return fail();
      }
    });
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private async usingDatabase<T>(name: string, action: (db: SQLiteDatabase) => Promise<T>) {
    const db = await openDatabaseAsync(name, OPEN_OPTIONS);
    try {
      await assertCipher(db);
      return await action(db);
    } finally {
      try {
        await db.closeAsync();
      } catch {
        this.connectionUnsafe = true;
        fail();
      }
    }
  }

  private async ensureCipher() {
    // Probe in memory first: Expo Go/plain SQLite must not create a disk file.
    await this.usingDatabase(':memory:', async () => undefined);
  }

  private async purge(marker: Marker) {
    // Durable intent first; replacing the key marker also drops the stored key.
    if (marker.state !== 'purging') {
      await writeMarker({ version: 1, ownerId: marker.ownerId, state: 'purging' });
    }
    for (const suffix of FILE_SUFFIXES) {
      if (await fileExists(suffix)) await deleteAsync(databaseUri(suffix), { idempotent: true });
    }
    if (await anyDatabaseFiles()) fail();
    await SecureStore.deleteItemAsync(MARKER, KEY_OPTIONS);
  }

  private async checkedMarker() {
    const marker = await readMarker();
    if (!marker && (await anyDatabaseFiles())) fail();
    return marker;
  }

  prepareVerifiedOwner(ownerId: string) {
    return this.enqueue(async () => {
      this.preparedOwner = null;
      if (!ownerSchema.safeParse(ownerId).success) fail();
      await this.ensureCipher();
      const marker = await this.checkedMarker();
      if (marker && (marker.state === 'purging' || marker.ownerId !== ownerId)) {
        await this.purge(marker);
      }
      this.preparedOwner = ownerId;
    });
  }

  purgePersistedOwner() {
    return this.enqueue(async () => {
      this.preparedOwner = null;
      const marker = await this.checkedMarker();
      if (marker) await this.purge(marker);
    });
  }

  private async ownedMarker(ownerId: string) {
    if (this.preparedOwner !== ownerId || !ownerSchema.safeParse(ownerId).success) fail();
    const marker = await this.checkedMarker();
    if (marker && (marker.ownerId !== ownerId || marker.state === 'purging')) fail();
    return marker as KeyMarker | null;
  }

  private async createMarker(ownerId: string): Promise<KeyMarker> {
    await this.ensureCipher();
    const bytes = await getRandomBytesAsync(32);
    if (bytes.length !== 32) fail();
    const key = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    bytes.fill(0);
    const marker = markerSchema.parse({ version: 1, ownerId, state: 'provisioning', key });
    if (marker.state === 'purging') fail();
    await writeMarker(marker);
    return marker;
  }

  private async withOwnedDatabase<T>(
    marker: KeyMarker,
    action: (db: SQLiteDatabase) => Promise<T>,
  ) {
    await this.ensureCipher();
    const exists = await fileExists('');
    if (!exists && (marker.state === 'ready' || (await anyDatabaseFiles()))) fail();
    return this.usingDatabase(DATABASE, async (db) => {
      // Only validated, generated 32-byte hex keys are interpolated. No user text.
      await db.execAsync(`PRAGMA key = "x'${marker.key}'"`);
      const schema = await db.getFirstAsync<{ count: number }>(
        'SELECT count(*) AS count FROM sqlite_master',
      );
      if (!schema || typeof schema.count !== 'number') fail();
      const journal = await db.getFirstAsync<{ journal_mode: string }>(
        'PRAGMA journal_mode = DELETE',
      );
      if (journal?.journal_mode.toLowerCase() !== 'delete') fail();
      await db.execAsync('PRAGMA temp_store = MEMORY');
      const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
      if (version?.user_version === 0 && marker.state === 'provisioning' && schema.count === 0) {
        await db.execAsync(
          'BEGIN IMMEDIATE; CREATE TABLE draft (slot INTEGER PRIMARY KEY CHECK (slot = 1), owner_id TEXT NOT NULL, payload TEXT NOT NULL); PRAGMA user_version = 1; COMMIT;',
        );
      } else if (version?.user_version !== 1) {
        fail();
      }
      // Verify the expected schema before marking provisioned. Do not overwrite
      // an existing foreign owner, corrupt database or unknown schema version.
      const row = await db.getFirstAsync<{ owner_id: string }>(
        'SELECT owner_id FROM draft WHERE slot = 1',
      );
      if (row && row.owner_id !== marker.ownerId) fail();
      if (marker.state === 'provisioning') {
        await writeMarker({ ...marker, state: 'ready' });
      }
      return action(db);
    });
  }

  read(ownerId: string) {
    return this.enqueue(async () => {
      const marker = await this.ownedMarker(ownerId);
      if (!marker) return null;
      return this.withOwnedDatabase(marker, async (db) => {
        const row = await db.getFirstAsync<{ payload: string }>(
          'SELECT payload FROM draft WHERE slot = 1 AND owner_id = ?',
          ownerId,
        );
        return row?.payload ?? null;
      });
    });
  }

  write(ownerId: string, serialized: string) {
    return this.enqueue(async () => {
      if (!parseOwnedWorkoutDraft(serialized, ownerId)) fail();
      const marker = (await this.ownedMarker(ownerId)) ?? (await this.createMarker(ownerId));
      await this.withOwnedDatabase(marker, async (db) => {
        const existing = await db.getFirstAsync<{ payload: string }>(
          'SELECT payload FROM draft WHERE slot = 1 AND owner_id = ?',
          ownerId,
        );
        if (existing && !parseOwnedWorkoutDraft(existing.payload, ownerId)) fail();
        await db.runAsync(
          'INSERT INTO draft (slot, owner_id, payload) VALUES (1, ?, ?) ON CONFLICT(slot) DO UPDATE SET payload = excluded.payload WHERE owner_id = excluded.owner_id',
          ownerId,
          serialized,
        );
      });
    });
  }

  remove(ownerId: string) {
    return this.enqueue(async () => {
      if (!ownerSchema.safeParse(ownerId).success) fail();
      const marker = await this.checkedMarker();
      if (!marker) return;
      if (marker.ownerId !== ownerId) fail();
      await this.purge(marker);
    });
  }
}

export const encryptedOfflineDraftStorage: EncryptedOfflineDraftStorage =
  new NativeEncryptedDraftStorage();
