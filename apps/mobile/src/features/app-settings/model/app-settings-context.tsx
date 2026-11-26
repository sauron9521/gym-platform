import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import { useAuth } from '@/features/auth/model/auth-context';
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
type SettingsContextValue = {
  settings: SettingsState;
  setAutoRestTimer: (enabled: boolean) => Promise<void>;
  setRestDuration: (duration: RestDuration) => Promise<void>;
  setRestSound: (enabled: boolean) => Promise<void>;
  setRestVibration: (enabled: boolean) => Promise<void>;
  setKeepWorkoutScreenAwake: (enabled: boolean) => Promise<void>;
  reload: () => void;
  shouldAutoStartRestTimer: () => boolean;
};
const SettingsContext = createContext<SettingsContextValue | null>(null);
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

/** Non-secret, account-scoped preferences on this device, available offline. */
export function AppSettingsProvider({ children }: PropsWithChildren) {
  const { account } = useAuth();
  const accountId = account?.id ?? null;
  const [state, setState] = useState(() => initial(accountId));
  // Reset the render state on account changes before exposing a preference.
  if (state.accountId !== accountId) setState(initial(accountId));
  const [revision, setRevision] = useState(0);
  const scopeRef = useRef<{ accountId: string; state: SettingsState } | null>(null);
  const pendingWrites = useRef(new Map<string, Promise<void>>());

  useEffect(() => {
    if (!accountId) return;
    const scope = { accountId, state: initial(accountId) };
    scopeRef.current = scope;
    // A fast sign-out/sign-in must not read before an earlier save settles.
    const pendingWrite = pendingWrites.current.get(accountId);
    const readPreferences = () =>
      Promise.all([
        AsyncStorage.getItem(preferenceKey(accountId, 'auto-rest-timer')),
        AsyncStorage.getItem(preferenceKey(accountId, 'rest-duration')),
        AsyncStorage.getItem(preferenceKey(accountId, 'rest-sound')),
        AsyncStorage.getItem(preferenceKey(accountId, 'rest-vibration')),
        AsyncStorage.getItem(preferenceKey(accountId, 'keep-workout-screen-awake')),
      ]);
    const read = pendingWrite
      ? pendingWrite.catch(() => undefined).then(readPreferences)
      : readPreferences();
    void read
      .then(([saved, duration, sound, vibration, keepAwake]) => {
        if (scopeRef.current !== scope) return;
        // A corrupt value is safe-off and can be overwritten by the user.
        scope.state = {
          accountId,
          enabled: saved === null || saved === 'true',
          restDuration: parseRestDuration(duration),
          restSound: sound === null || sound === 'true',
          restVibration: vibration === null || vibration === 'true',
          keepWorkoutScreenAwake: keepAwake === null || keepAwake === 'true',
          status: 'ready',
        };
        setState(scope.state);
      })
      .catch(() => {
        if (scopeRef.current !== scope) return;
        scope.state = { ...scope.state, status: 'readError' };
        setState(scope.state);
      });
    return () => {
      if (scopeRef.current === scope) scopeRef.current = null;
    };
  }, [accountId, revision]);

  const settings = state.accountId === accountId ? state : initial(accountId);
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
    const scope = scopeRef.current;
    if (!scope || scope.accountId !== accountId) return;
    if (scope.state.status !== 'ready' && scope.state.status !== 'saveError') return;
    scope.state = { ...scope.state, status: 'saving' };
    setState(scope.state);
    const write = Promise.resolve().then(() =>
      AsyncStorage.setItem(preferenceKey(scope.accountId, preference), value),
    );
    pendingWrites.current.set(scope.accountId, write);
    try {
      await write;
      if (scopeRef.current !== scope) return;
      scope.state = { ...scope.state, ...changes, status: 'ready' };
    } catch {
      if (scopeRef.current !== scope) return;
      scope.state = { ...scope.state, status: 'saveError' };
    } finally {
      if (pendingWrites.current.get(scope.accountId) === write) {
        pendingWrites.current.delete(scope.accountId);
      }
    }
    setState(scope.state);
  };
  const shouldAutoStartRestTimer = () => {
    // A pending workout write may complete after the preference changes.
    const scope = scopeRef.current;
    return Boolean(
      accountId &&
      scope?.accountId === accountId &&
      (scope.state.status === 'ready' ||
        scope.state.status === 'saving' ||
        scope.state.status === 'saveError') &&
      scope.state.enabled,
    );
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
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
        reload: () => {
          setState(initial(accountId));
          setRevision((value) => value + 1);
        },
        shouldAutoStartRestTimer,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useAppSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useAppSettings requires AppSettingsProvider');
  return context;
}
