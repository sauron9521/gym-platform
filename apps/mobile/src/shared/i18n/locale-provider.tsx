import { getFlatMessages, resolveLocale, type Locale } from '@gym/i18n';
import { getLocales } from 'expo-localization';
import { IntlProvider } from 'react-intl';
import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';

type LocaleContextValue = { locale: Locale; setLocale: (next: Locale) => void };
const LocaleContext = createContext<LocaleContextValue | null>(null);

/** Device language is initial state only; account sync/persistence comes separately. */
export function LocaleProvider({ children }: PropsWithChildren) {
  const [locale, setLocale] = useState<Locale>(() => resolveLocale(getLocales()[0]?.languageTag));
  const messages = useMemo(() => getFlatMessages(locale), [locale]);
  const value = useMemo(() => ({ locale, setLocale }), [locale]);
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
