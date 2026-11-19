'use client';

import { isLocale, type Locale } from '@gym/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { webApi } from '@/shared/api/client';
import { useAuthFailure } from '@/shared/api/use-auth-failure';
import { LocaleSwitcher, rememberLocale } from '@/shared/ui/locale-switcher';

import { ProfileMutationError } from '../api/profile-mutations';
import { ProfileRequestError, profileQueryOptions } from '../api/profile-query';

/** Authenticated shell: account preference wins once the verified profile is loaded. */
export function AccountLocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations('common');
  const router = useRouter();
  const queryClient = useQueryClient();
  const onAuthFailure = useAuthFailure();
  const profileOptions = profileQueryOptions();
  const profile = useQuery(profileOptions);

  const mutation = useMutation({
    mutationFn: async (next: Locale) => {
      try {
        const { response, data } = await webApi.PATCH('/users/me/preferences', {
          body: { preferredLocale: next },
        });
        if (response.status !== 200 || !data || data.preferredLocale !== next) {
          throw new ProfileMutationError(response.status);
        }
        return data;
      } catch (error) {
        if (error instanceof ProfileMutationError) throw error;
        throw new ProfileMutationError();
      }
    },
    onSuccess: (account, next) => {
      // Update the canonical profile before refreshing; an old query must not undo a new choice.
      queryClient.setQueryData(profileOptions.queryKey, account);
      rememberLocale(next);
      router.refresh();
    },
    onError: onAuthFailure,
    retry: false,
  });

  useEffect(() => {
    if (profile.error instanceof ProfileRequestError) onAuthFailure(profile.error);
  }, [profile.error, onAuthFailure]);

  useEffect(() => {
    const saved = profile.data?.preferredLocale;
    if (mutation.isPending || !isLocale(saved) || saved === locale) return;
    rememberLocale(saved);
    router.refresh();
  }, [profile.data?.preferredLocale, locale, mutation.isPending, router]);

  const error = mutation.isError
    ? t('languageUpdateError')
    : profile.isError
      ? t('languageLoadError')
      : null;

  return (
    <span className="inline-flex items-start gap-2">
      <LocaleSwitcher
        disabled={profile.isPending || profile.isError || mutation.isPending}
        error={error}
        onLocaleChange={(next) => {
          if (!profile.data || mutation.isPending) return;
          mutation.reset();
          mutation.mutate(next);
        }}
      />
      {profile.isError && (
        <button
          type="button"
          className="rounded-md border border-border px-2 py-1 text-xs focus-visible:outline-2 focus-visible:outline-ring"
          onClick={() => void profile.refetch()}
        >
          {t('retry')}
        </button>
      )}
    </span>
  );
}
