import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFlatMessages, isLocale, resolveLocale, type Locale } from '@gym/i18n';
import { getLocales } from 'expo-localization';
import { IntlProvider } from 'react-intl';
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

const STORAGE_KEY = 'gym-platform:preferred-locale';
type LocaleContextValue = { locale: Locale; setLocale: (next: Locale) => void };
const LocaleContext = createContext<LocaleContextValue | null>(null);

/** Local non-secret preference is persisted across native/Web restarts. */
export function LocaleProvider({ children }: PropsWithChildren) {
  const [locale, updateLocale] = useState<Locale>(() =>
    resolveLocale(getLocales()[0]?.languageTag),
  );
  const explicitlyChanged = useRef(false);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (active && !explicitlyChanged.current && isLocale(saved)) updateLocale(saved);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const setLocale = useCallback((next: Locale) => {
    // Account language or a new tap must beat an outdated pending storage read.
    explicitlyChanged.current = true;
    updateLocale(next);
    void AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const messages = useMemo(() => getFlatMessages(locale), [locale]);
  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return (
    <LocaleContext.Provider value={value}>
      <IntlProvider locale={locale} defaultLocale="uk" messages={messages}>
        {children}
      </IntlProvider>
    </LocaleContext.Provider>
  );
}

export function useLocaleSelection(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) throw new Error('useLocaleSelection requires LocaleProvider');
  return context;
}
