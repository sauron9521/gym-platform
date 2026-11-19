import { useEffect } from 'react';

import { useAuth } from '@/features/auth/model/auth-context';
import { useLocaleSelection } from '@/shared/i18n/locale-provider';

/** Apply saved account preference only after verified session restoration or sign-in. */
export function AccountLocaleSync() {
  const { account } = useAuth();
  const { setLocale } = useLocaleSelection();

  useEffect(() => {
    if (account?.preferredLocale === 'en' || account?.preferredLocale === 'uk') {
      setLocale(account.preferredLocale);
    }
  }, [account?.id, account?.preferredLocale, setLocale]);
  return null;
}
