import { useRef, useState } from 'react';
import type { Locale } from '@gym/i18n';
import { useIntl } from 'react-intl';

import { useAuth } from '@/features/auth/model/auth-context';
import { LocalePicker } from '@/shared/i18n/locale-picker';
import { useLocaleSelection } from '@/shared/i18n/locale-provider';

/** Commit signed-in preference to the API before changing the local selection. */
export function AccountLocalePicker() {
  const { account, getApi } = useAuth();
  const { locale, setLocale } = useLocaleSelection();
  const intl = useIntl();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const inFlight = useRef(false);

  async function choose(next: Locale) {
    if (next === locale || inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(false);
    try {
      if (account) {
        const api = getApi();
        if (!api) throw new Error('API unavailable');
        const result = await api.PATCH('/users/me/preferences', {
          body: { preferredLocale: next },
        });
        if (result.response.status !== 200 || result.data?.preferredLocale !== next) {
          throw new Error('Locale preference not confirmed');
        }
      }
      setLocale(next);
    } catch {
      setError(true);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <LocalePicker
      disabled={pending}
      error={
        error ? intl.formatMessage({ id: 'common.languageUpdateError' }) : null
      }
      onSelect={(next) => void choose(next)}
    />
  );
}
