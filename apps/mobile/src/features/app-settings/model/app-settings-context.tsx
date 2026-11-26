import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { useStore } from 'zustand';

import { useAuth } from '@/features/auth/model/auth-context';
import {
  createAppSettingsStore,
  type AppSettingsState,
  type AppSettingsStore,
} from './app-settings-store';

const SettingsContext = createContext<AppSettingsStore | null>(null);

/** Stable context transports the account-scoped store; consumers select their own values. */
export function AppSettingsProvider({ children }: PropsWithChildren) {
  const { account } = useAuth();
  const accountId = account?.id ?? null;
  const [pendingWrites] = useState(() => new Map<string, Promise<void>>());
  const instance = useMemo(
    () => createAppSettingsStore(accountId, pendingWrites),
    [accountId, pendingWrites],
  );
  useEffect(() => instance.activate(), [instance]);
  return <SettingsContext.Provider value={instance.store}>{children}</SettingsContext.Provider>;
}

export function useAppSettings<T>(selector: (state: AppSettingsState) => T): T {
  const store = useContext(SettingsContext);
  if (!store) throw new Error('useAppSettings requires AppSettingsProvider');
  return useStore(store, selector);
}
