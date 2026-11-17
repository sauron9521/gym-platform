'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { profileQueryOptions } from '@/features/profile/api/profile-query';

/** Apply the saved account language after a verified session is available. */
export function AccountLocaleSync() {
  const locale = useLocale();
  const router = useRouter();
  const { data } = useQuery(profileQueryOptions());

  useEffect(() => {
    const saved = data?.preferredLocale;
    if ((saved === 'uk' || saved === 'en') && saved !== locale) {
      document.cookie = `gym-locale=${saved}; Path=/; Max-Age=31536000; SameSite=Lax`;
      router.refresh();
    }
  }, [data?.preferredLocale, locale, router]);

  return null;
}
