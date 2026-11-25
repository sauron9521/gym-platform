import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { useColorScheme } from 'react-native';
import {
  isThemePreference,
  mobilePalettes,
  resolveMobileTheme,
  type MobilePalette,
  type ThemePreference,
} from './theme';

const STORAGE_KEY = 'gym-platform:preferred-theme';
type ThemeContextValue = {
  preference: ThemePreference;
  mode: 'light' | 'dark';
  palette: MobilePalette;
  setPreference: (preference: ThemePreference) => void;
};

// Standalone components have a stable dark fallback (including isolated tests).
const ThemeContext = createContext<ThemeContextValue>({
  preference: 'system',
  mode: 'dark',
  palette: mobilePalettes.dark,
  setPreference: () => undefined,
});

export function MobileThemeProvider({ children }: PropsWithChildren) {
  const [preference, updatePreference] = useState<ThemePreference>('system');
  const system = useColorScheme();
  const changed = useRef(false);
  const writeQueue = useRef(Promise.resolve());
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (active && !changed.current && isThemePreference(saved)) updatePreference(saved);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    changed.current = true;
    updatePreference(next);
    // Persist in selection order, even when a previous write fails.
    writeQueue.current = writeQueue.current
      .then(() => AsyncStorage.setItem(STORAGE_KEY, next))
      .catch(() => undefined);
  }, []);

  const mode = resolveMobileTheme(preference, system);
  const value = useMemo(
    () => ({
      preference,
      mode,
      palette: mobilePalettes[mode],
      setPreference,
    }),
    [preference, mode, setPreference],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useMobileTheme() {
  return useContext(ThemeContext);
}

/** Create both immutable stylesheets once, then select the active one reactively. */
export function createThemedStyles<T>(factory: (palette: MobilePalette) => T) {
  const styles = { light: factory(mobilePalettes.light), dark: factory(mobilePalettes.dark) };
  return function useThemedStyles() {
    return styles[useMobileTheme().mode];
  };
}
