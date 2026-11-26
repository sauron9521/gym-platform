import { QueryClient, onlineManager } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildWorkoutPreferenceInitialization,
  confirmedWorkoutPreferencesKey,
  effectiveWorkoutPreferences,
  legacyWorkoutPreferenceKey,
  parseStoredWorkoutPreferences,
  readConfirmedWorkoutPreferences,
  readLegacyWorkoutPreferences,
  saveConfirmedWorkoutPreferences,
} from '@/features/app-settings/model/account-workout-preferences';
import {
  workoutPreferencesQueryOptions,
  writeWorkoutPreferences,
} from '@/features/app-settings/model/account-workout-preferences-query';
import { accountQueryKeys } from '@/shared/api/query-client';

const unset = { autoRestTimer: null, restDurationSeconds: null };
const saved = { autoRestTimer: false, restDurationSeconds: 120 } as const;
const account = 'athlete-a';

function memoryStorage(entries: Record<string, string> = {}) {
  const values = new Map(Object.entries(entries));
  return {
    getItem: vi.fn(async (key: string) => values.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      values.set(key, value);
    }),
  };
}

function transport() {
  let current = true;
  const ok = { response: { status: 200 }, data: saved };
  const api = {
    GET: vi.fn().mockResolvedValue(ok),
    POST: vi.fn().mockResolvedValue(ok),
    PATCH: vi.fn().mockResolvedValue(ok),
  };
  const scope = {
    accountId: account,
    isCurrent: () => current,
    getScopedApi: vi.fn(() => api as never),
  };
  return { api, scope, expire: () => (current = false) };
}

afterEach(() => onlineManager.setOnline(true));

describe('account workout preference storage policy', () => {
  it('migrates only explicit legacy values and preserves false', async () => {
    const storage = memoryStorage({
      [legacyWorkoutPreferenceKey(account, 'auto-rest-timer')]: 'false',
      [legacyWorkoutPreferenceKey(account, 'rest-duration')]: '120',
    });
    const legacy = await readLegacyWorkoutPreferences(storage, account);
    expect(buildWorkoutPreferenceInitialization(unset, legacy)).toEqual(saved);
    expect(
      buildWorkoutPreferenceInitialization({ ...unset, restDurationSeconds: 60 }, legacy),
    ).toEqual({ autoRestTimer: false });
    expect(
      buildWorkoutPreferenceInitialization({ ...saved, autoRestTimer: true }, legacy),
    ).toBeNull();
    expect(
      buildWorkoutPreferenceInitialization(
        unset,
        await readLegacyWorkoutPreferences(storage, 'athlete-b'),
      ),
    ).toBeNull();
  });

  it.each(['', '090', '90.0', ' 90', '9e1', '91', 'null'])(
    'does not import invalid duration %j',
    async (value) => {
      const legacy = await readLegacyWorkoutPreferences(
        memoryStorage({
          [legacyWorkoutPreferenceKey(account, 'auto-rest-timer')]: 'invalid',
          [legacyWorkoutPreferenceKey(account, 'rest-duration')]: value,
        }),
        account,
      );
      expect(buildWorkoutPreferenceInitialization(unset, legacy)).toBeNull();
      expect(effectiveWorkoutPreferences(null, legacy)).toEqual({
        autoRestTimer: false,
        restDurationSeconds: 90,
      });
    },
  );

  it('does not initialize default values for a fresh install', async () => {
    const legacy = await readLegacyWorkoutPreferences(memoryStorage(), account);
    expect(buildWorkoutPreferenceInitialization(unset, legacy)).toBeNull();
    expect(effectiveWorkoutPreferences(unset, legacy)).toEqual({
      autoRestTimer: true,
      restDurationSeconds: 90,
    });
  });

  it('handles independent storage read failures without synthesizing migration values', async () => {
    const storage = memoryStorage({ [legacyWorkoutPreferenceKey(account, 'rest-duration')]: '60' });
    storage.getItem.mockRejectedValueOnce(new Error('read failed'));
    const legacy = await readLegacyWorkoutPreferences(storage, account);
    expect(buildWorkoutPreferenceInitialization(unset, legacy)).toEqual({
      restDurationSeconds: 60,
    });
    expect(effectiveWorkoutPreferences(null, legacy)).toEqual({
      autoRestTimer: false,
      restDurationSeconds: 60,
    });
  });

  it('stores confirmed snapshots separately, scoped to the account; never writes legacy keys', async () => {
    const storage = memoryStorage({
      [legacyWorkoutPreferenceKey(account, 'auto-rest-timer')]: 'true',
      [legacyWorkoutPreferenceKey(account, 'rest-duration')]: '60',
    });
    await saveConfirmedWorkoutPreferences(storage, account, saved);
    expect(storage.setItem).toHaveBeenCalledExactlyOnceWith(
      confirmedWorkoutPreferencesKey(account),
      JSON.stringify(saved),
    );
    expect(await readConfirmedWorkoutPreferences(storage, 'athlete-b')).toBeNull();
    const confirmed = await readConfirmedWorkoutPreferences(storage, account);
    expect(
      effectiveWorkoutPreferences(confirmed, await readLegacyWorkoutPreferences(storage, account)),
    ).toEqual(saved);
  });

  it('retains nullable canonical fields and rejects malformed data', async () => {
    const storage = memoryStorage();
    await saveConfirmedWorkoutPreferences(storage, account, unset);
    expect(await readConfirmedWorkoutPreferences(storage, account)).toEqual(unset);
    for (const invalid of [
      null,
      {},
      [],
      { autoRestTimer: true },
      { autoRestTimer: 'false', restDurationSeconds: 90 },
      { autoRestTimer: false, restDurationSeconds: 91 },
      { ...saved, userId: account },
    ]) {
      expect(parseStoredWorkoutPreferences(invalid)).toBeNull();
    }
    await expect(
      saveConfirmedWorkoutPreferences(storage, account, {
        ...saved,
        restDurationSeconds: 91,
      } as never),
    ).rejects.toThrow();
    expect(
      await readConfirmedWorkoutPreferences(
        memoryStorage({ [confirmedWorkoutPreferencesKey(account)]: '{' }),
        account,
      ),
    ).toBeNull();
  });
});

describe('account workout preference transport', () => {
  it('reads only through an account-scoped TanStack Query key', async () => {
    const { api, scope } = transport();
    const queryClient = new QueryClient();
    const options = workoutPreferencesQueryOptions(scope);
    expect(options.queryKey).toEqual(accountQueryKeys.workoutPreferences(account));
    expect(options.refetchOnReconnect).toBe('always');
    expect(options.refetchOnWindowFocus).toBe('always');
    await expect(queryClient.fetchQuery(options)).resolves.toEqual(saved);
    expect(queryClient.getQueryData(options.queryKey)).toEqual(saved);
    expect(
      queryClient.getQueryData(accountQueryKeys.workoutPreferences('athlete-b')),
    ).toBeUndefined();
    expect(api.GET).toHaveBeenCalledOnce();
    expect(api.POST).not.toHaveBeenCalled();
    expect(api.PATCH).not.toHaveBeenCalled();
    queryClient.clear();
  });

  it('uses explicit online initialization and patch endpoints without retry', async () => {
    const { api, scope } = transport();
    await expect(
      writeWorkoutPreferences(scope, 'initialize', { autoRestTimer: false }),
    ).resolves.toEqual(saved);
    await expect(
      writeWorkoutPreferences(scope, 'update', { restDurationSeconds: 120 }),
    ).resolves.toEqual(saved);
    expect(api.POST).toHaveBeenCalledExactlyOnceWith('/users/me/preferences/workouts/initialize', {
      body: { autoRestTimer: false },
    });
    expect(api.PATCH).toHaveBeenCalledExactlyOnceWith('/users/me/preferences/workouts', {
      body: { restDurationSeconds: 120 },
    });
    api.PATCH.mockRejectedValueOnce(new Error('lost response'));
    await expect(writeWorkoutPreferences(scope, 'update', { autoRestTimer: true })).rejects.toThrow(
      'lost response',
    );
    expect(api.PATCH).toHaveBeenCalledTimes(2);
    expect(api.GET).not.toHaveBeenCalled();
  });

  it('does not enqueue writes offline or issue a stale account request', async () => {
    const { api, scope, expire } = transport();
    onlineManager.setOnline(false);
    await expect(
      writeWorkoutPreferences(scope, 'update', { autoRestTimer: true }),
    ).rejects.toThrow();
    onlineManager.setOnline(true);
    expire();
    await expect(
      writeWorkoutPreferences(scope, 'initialize', { autoRestTimer: false }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(scope.getScopedApi).not.toHaveBeenCalled();
    expect(api.PATCH).not.toHaveBeenCalled();
    expect(api.POST).not.toHaveBeenCalled();
  });

  it('rejects a late write acknowledgement after account scope expires', async () => {
    const { api, scope, expire } = transport();
    api.PATCH.mockImplementationOnce(async () => {
      expire();
      return { response: { status: 200 }, data: saved };
    });
    await expect(
      writeWorkoutPreferences(scope, 'update', { autoRestTimer: false }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('rejects malformed or unauthorized responses', async () => {
    const { api, scope } = transport();
    api.POST.mockResolvedValueOnce({ response: { status: 200 }, data: { autoRestTimer: true } });
    await expect(
      writeWorkoutPreferences(scope, 'initialize', { autoRestTimer: true }),
    ).rejects.toThrow('Invalid');
    api.PATCH.mockResolvedValueOnce({ response: { status: 401 } });
    await expect(
      writeWorkoutPreferences(scope, 'update', { autoRestTimer: true }),
    ).rejects.toMatchObject({ name: 'MobileSessionExpiredError' });
  });
});
