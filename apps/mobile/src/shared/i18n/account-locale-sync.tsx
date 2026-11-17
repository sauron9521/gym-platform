import { useEffect } from 'react';

import { useAuth } from '@/features/auth/model/auth-context';
import { useLocaleSelection } from './locale-provider';

/** Respect the explicit account language after session restoration/sign-in. */
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
