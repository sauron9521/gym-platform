'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { webApi } from '@/shared/api/client';
import { profileQueryOptions } from '@/features/profile/api/profile-query';

function rememberLocale(locale: 'uk' | 'en') {
  document.cookie = `gym-locale=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

/** Keep account preference authoritative, with guest choice stored in a cookie. */
export function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations('common');
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function changeLocale(value: string) {
    if ((value !== 'uk' && value !== 'en') || pending || value === locale) return;
    setPending(true);
    setError(false);
    try {
      const account = await webApi.GET('/users/me');
      if (account.response.status === 200 && account.data) {
        const result = await webApi.PATCH('/users/me/preferences', {
          body: { preferredLocale: value },
        });
        if (result.response.status !== 200 || !result.data) throw new Error('Preference update failed');
        // Prevent stale profile data from immediately reverting the user's choice.
        queryClient.setQueryData(profileQueryOptions().queryKey, result.data);
      } else if (account.response.status !== 401 && account.response.status !== 403) {
        throw new Error('Cannot verify session');
      }
      rememberLocale(value);
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <select
        aria-label={t('language')}
        className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
        disabled={pending}
        value={locale}
        onChange={(event) => void changeLocale(event.target.value)}
      >
        <option value="uk">Українська</option>
        <option value="en">English</option>
      </select>
      {error ? (
        <span role="alert" className="text-xs text-destructive">
          {t('retry')}
        </span>
      ) : null}
    </span>
  );
}
