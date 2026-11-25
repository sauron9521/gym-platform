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

type SettingsState = {
  accountId: string | null;
  enabled: boolean;
  status: 'loading' | 'ready' | 'saving' | 'readError' | 'saveError';
};
type SettingsContextValue = {
  settings: SettingsState;
  setAutoRestTimer: (enabled: boolean) => Promise<void>;
  reload: () => void;
  shouldAutoStartRestTimer: () => boolean;
};
const SettingsContext = createContext<SettingsContextValue | null>(null);

const initial = (accountId: string | null): SettingsState => ({
  accountId,
  enabled: false,
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
    const key = `gym-platform:app-settings:v1:${accountId}:auto-rest-timer`;
    const scope = { accountId, state: initial(accountId) };
    scopeRef.current = scope;
    // A fast sign-out/sign-in must not read before an earlier save settles.
    const pendingWrite = pendingWrites.current.get(accountId);
    const read = pendingWrite
      ? pendingWrite.catch(() => undefined).then(() => AsyncStorage.getItem(key))
      : AsyncStorage.getItem(key);
    void read
      .then((saved) => {
        if (scopeRef.current !== scope) return;
        // A corrupt value is safe-off and can be overwritten by the user.
        scope.state = {
          accountId,
          enabled: saved === null || saved === 'true',
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
  const setAutoRestTimer = async (enabled: boolean) => {
    const scope = scopeRef.current;
    if (!scope || scope.accountId !== accountId) return;
    if (scope.state.status !== 'ready' && scope.state.status !== 'saveError') return;
    scope.state = { ...scope.state, status: 'saving' };
    setState(scope.state);
    const write = AsyncStorage.setItem(
      `gym-platform:app-settings:v1:${scope.accountId}:auto-rest-timer`,
      String(enabled),
    );
    pendingWrites.current.set(scope.accountId, write);
    try {
      await write;
      if (scopeRef.current !== scope) return;
      scope.state = { ...scope.state, enabled, status: 'ready' };
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
        setAutoRestTimer,
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
