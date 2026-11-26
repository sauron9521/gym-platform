import AsyncStorage from '@react-native-async-storage/async-storage';
import { createStore } from 'zustand/vanilla';

import { defaultRestDuration, type RestDuration } from '@/shared/config/rest-duration';
import {
  activateAccountWorkoutPreferences,
  type AccountPreferenceConnection,
  type AccountPreferenceStatus,
} from './account-workout-preferences-runtime';

type SettingsState = {
  accountId: string | null;
  enabled: boolean;
  restDuration: RestDuration;
  restSound: boolean;
  restVibration: boolean;
  keepWorkoutScreenAwake: boolean;
  status: 'loading' | 'ready' | 'saving' | 'readError' | 'saveError';
  accountStatus: AccountPreferenceStatus;
};

export type AppSettingsState = {
  settings: SettingsState;
  setAutoRestTimer: (enabled: boolean) => Promise<void>;
  setRestDuration: (duration: RestDuration) => Promise<void>;
  setRestSound: (enabled: boolean) => Promise<void>;
  setRestVibration: (enabled: boolean) => Promise<void>;
  setKeepWorkoutScreenAwake: (enabled: boolean) => Promise<void>;
  reload: () => void;
  retryAccount: () => void;
  shouldAutoStartRestTimer: () => boolean;
};

type DeviceKey = 'rest-sound' | 'rest-vibration' | 'keep-workout-screen-awake';
const preferenceKey = (accountId: string, preference: DeviceKey) =>
  `gym-platform:app-settings:v1:${accountId}:${preference}`;

const initial = (accountId: string | null): SettingsState => ({
  accountId,
  enabled: false,
  restDuration: defaultRestDuration,
  restSound: false,
  restVibration: false,
  keepWorkoutScreenAwake: false,
  status: 'loading',
  accountStatus: 'loading',
});

export function autoRestTimerEnabled({ settings }: AppSettingsState) {
  return Boolean(settings.accountId && settings.enabled);
}

/** Only device preferences are owned here. Account values are a read-only
 * effective projection of the query/fallback runtime for timer selectors. */
export function createAppSettingsStore(
  accountId: string | null,
  pendingWrites: Map<string, Promise<void>>,
  connection: AccountPreferenceConnection,
  pendingSnapshots: Map<string, Promise<void>>,
) {
  let active = false;
  let generation = 0;
  let runtime: ReturnType<typeof activateAccountWorkoutPreferences> | undefined;
  const store = createStore<AppSettingsState>()((set, get) => {
    const reload = () => {
      if (!active || !accountId) return;
      const revision = ++generation;
      set({
        settings: {
          ...get().settings,
          restSound: false,
          restVibration: false,
          keepWorkoutScreenAwake: false,
          status: 'loading',
        },
      });
      const pendingWrite = pendingWrites.get(accountId);
      void Promise.resolve(pendingWrite)
        .catch(() => undefined)
        .then(() => {
          if (!active || generation !== revision) return undefined;
          return Promise.all([
            AsyncStorage.getItem(preferenceKey(accountId, 'rest-sound')),
            AsyncStorage.getItem(preferenceKey(accountId, 'rest-vibration')),
            AsyncStorage.getItem(preferenceKey(accountId, 'keep-workout-screen-awake')),
          ]);
        })
        .then((values) => {
          if (!values || !active || generation !== revision) return;
          const [sound, vibration, keepAwake] = values;
          set({
            settings: {
              ...get().settings,
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
      preference: DeviceKey,
      value: boolean,
      changes: Partial<
        Pick<SettingsState, 'restSound' | 'restVibration' | 'keepWorkoutScreenAwake'>
      >,
    ) => {
      if (!active || !accountId) return;
      const { settings } = get();
      if (settings.status !== 'ready' && settings.status !== 'saveError') return;
      const revision = generation;
      const write = Promise.resolve().then(() =>
        AsyncStorage.setItem(preferenceKey(accountId, preference), String(value)),
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
      setAutoRestTimer: async (autoRestTimer) => runtime?.update({ autoRestTimer }),
      setRestDuration: async (restDurationSeconds) => runtime?.update({ restDurationSeconds }),
      setRestSound: (restSound) => savePreference('rest-sound', restSound, { restSound }),
      setRestVibration: (restVibration) =>
        savePreference('rest-vibration', restVibration, { restVibration }),
      setKeepWorkoutScreenAwake: (keepWorkoutScreenAwake) =>
        savePreference('keep-workout-screen-awake', keepWorkoutScreenAwake, {
          keepWorkoutScreenAwake,
        }),
      reload,
      retryAccount: () => runtime?.retry(),
      shouldAutoStartRestTimer: () => active && autoRestTimerEnabled(get()),
    };
  });

  return {
    store,
    activate() {
      active = true;
      store.getState().reload();
      if (accountId) {
        runtime = activateAccountWorkoutPreferences(
          accountId,
          connection,
          pendingSnapshots,
          (values, accountStatus) => {
            if (!active) return;
            store.setState(({ settings }) => ({
              settings: {
                ...settings,
                ...(values
                  ? { enabled: values.autoRestTimer, restDuration: values.restDurationSeconds }
                  : {}),
                accountStatus,
              },
            }));
          },
        );
      }
      return () => {
        active = false;
        generation += 1;
        runtime?.close();
        runtime = undefined;
        store.setState({ settings: initial(accountId) });
      };
    },
  };
}

export type AppSettingsStore = ReturnType<typeof createAppSettingsStore>['store'];
