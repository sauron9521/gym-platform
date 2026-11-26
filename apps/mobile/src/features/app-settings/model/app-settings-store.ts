import AsyncStorage from '@react-native-async-storage/async-storage';
import { createStore } from 'zustand/vanilla';
import { defaultWorkoutPreferences } from '@gym/domain';

import {
  defaultRestDuration,
  parseRestDuration,
  type RestDuration,
} from '@/shared/config/rest-duration';

type SettingsState = {
  accountId: string | null;
  enabled: boolean;
  restDuration: RestDuration;
  restSound: boolean;
  restVibration: boolean;
  keepWorkoutScreenAwake: boolean;
  status: 'loading' | 'ready' | 'saving' | 'readError' | 'saveError';
};

export type AppSettingsState = {
  settings: SettingsState;
  setAutoRestTimer: (enabled: boolean) => Promise<void>;
  setRestDuration: (duration: RestDuration) => Promise<void>;
  setRestSound: (enabled: boolean) => Promise<void>;
  setRestVibration: (enabled: boolean) => Promise<void>;
  setKeepWorkoutScreenAwake: (enabled: boolean) => Promise<void>;
  reload: () => void;
  shouldAutoStartRestTimer: () => boolean;
};

type PreferenceKey =
  | 'auto-rest-timer'
  | 'rest-duration'
  | 'rest-sound'
  | 'rest-vibration'
  | 'keep-workout-screen-awake';
const preferenceKey = (accountId: string, preference: PreferenceKey) =>
  `gym-platform:app-settings:v1:${accountId}:${preference}`;

const initial = (accountId: string | null): SettingsState => ({
  accountId,
  enabled: false,
  restDuration: defaultRestDuration,
  restSound: false,
  restVibration: false,
  keepWorkoutScreenAwake: false,
  status: 'loading',
});

export function autoRestTimerEnabled({ settings }: AppSettingsState) {
  return Boolean(
    settings.accountId &&
    (settings.status === 'ready' ||
      settings.status === 'saving' ||
      settings.status === 'saveError') &&
    settings.enabled,
  );
}

/** Each verified account gets a separate in-memory store. Only the existing
 * AsyncStorage keys are durable; pending writes survive account switches. */
export function createAppSettingsStore(
  accountId: string | null,
  pendingWrites: Map<string, Promise<void>>,
) {
  let active = false;
  let generation = 0;
  const store = createStore<AppSettingsState>()((set, get) => {
    const reload = () => {
      if (!active || !accountId) return;
      const revision = ++generation;
      set({ settings: initial(accountId) });
      const readPreferences = () =>
        Promise.all([
          AsyncStorage.getItem(preferenceKey(accountId, 'auto-rest-timer')),
          AsyncStorage.getItem(preferenceKey(accountId, 'rest-duration')),
          AsyncStorage.getItem(preferenceKey(accountId, 'rest-sound')),
          AsyncStorage.getItem(preferenceKey(accountId, 'rest-vibration')),
          AsyncStorage.getItem(preferenceKey(accountId, 'keep-workout-screen-awake')),
        ]);
      const pendingWrite = pendingWrites.get(accountId);
      void Promise.resolve(pendingWrite)
        .catch(() => undefined)
        .then(() => {
          if (!active || generation !== revision) return undefined;
          return readPreferences();
        })
        .then((values) => {
          if (!values || !active || generation !== revision) return;
          const [saved, duration, sound, vibration, keepAwake] = values;
          set({
            settings: {
              accountId,
              enabled: saved === null ? defaultWorkoutPreferences.autoRestTimer : saved === 'true',
              restDuration: parseRestDuration(duration),
              restSound: sound === null || sound === 'true',
              restVibration: vibration === null || vibration === 'true',
              keepWorkoutScreenAwake: keepAwake === null || keepAwake === 'true',
              status: 'ready',
            },
          });
        })
        .catch(() => {
          if (!active || generation !== revision) return;
          set({ settings: { ...get().settings, status: 'readError' } });
        });
    };

    const savePreference = async (
      preference: PreferenceKey,
      value: string,
      changes: Partial<
        Pick<
          SettingsState,
          'enabled' | 'restDuration' | 'restSound' | 'restVibration' | 'keepWorkoutScreenAwake'
        >
      >,
    ) => {
      if (!active || !accountId) return;
      const { settings } = get();
      if (settings.status !== 'ready' && settings.status !== 'saveError') return;
      const revision = generation;
      const write = Promise.resolve().then(() =>
        AsyncStorage.setItem(preferenceKey(accountId, preference), value),
      );
      pendingWrites.set(accountId, write);
      set({ settings: { ...settings, status: 'saving' } });
      try {
        await write;
        if (!active || revision !== generation) return;
        set({ settings: { ...get().settings, ...changes, status: 'ready' } });
      } catch {
        if (!active || revision !== generation) return;
        set({ settings: { ...get().settings, status: 'saveError' } });
      } finally {
        if (pendingWrites.get(accountId) === write) pendingWrites.delete(accountId);
      }
    };

    return {
      settings: initial(accountId),
      setAutoRestTimer: (enabled) =>
        savePreference('auto-rest-timer', String(enabled), { enabled }),
      setRestDuration: (restDuration) =>
        savePreference('rest-duration', String(restDuration), { restDuration }),
      setRestSound: (restSound) => savePreference('rest-sound', String(restSound), { restSound }),
      setRestVibration: (restVibration) =>
        savePreference('rest-vibration', String(restVibration), { restVibration }),
      setKeepWorkoutScreenAwake: (keepWorkoutScreenAwake) =>
        savePreference('keep-workout-screen-awake', String(keepWorkoutScreenAwake), {
          keepWorkoutScreenAwake,
        }),
      reload,
      // Read at confirmation time, not when the workout mutation was submitted.
      shouldAutoStartRestTimer: () => active && autoRestTimerEnabled(get()),
    };
  });

  return {
    store,
    activate() {
      active = true;
      store.getState().reload();
      return () => {
        active = false;
        generation += 1;
        store.setState({ settings: initial(accountId) });
      };
    },
  };
}

export type AppSettingsStore = ReturnType<typeof createAppSettingsStore>['store'];
