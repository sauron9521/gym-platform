'use client';

import type { Locale } from '@gym/i18n';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { getTrainerCopy } from '@/shared/i18n/copy';
import {
  parseThemePreference,
  THEME_COOKIE_MAX_AGE_SECONDS,
  THEME_COOKIE_NAME,
  type ThemePreference,
} from '@/shared/lib/theme-preference';

function setPreferenceCookie(name: string, value: string, maxAge: number) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${value}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

export function Preferences({
  locale,
  initialTheme,
}: {
  locale: Locale;
  initialTheme: ThemePreference;
}) {
  const router = useRouter();
  const [theme, setTheme] = useState(initialTheme);
  const t = getTrainerCopy(locale);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>{t.language}</span>
        <select
          aria-label={t.language}
          defaultValue={locale}
          className="min-h-11 rounded-lg border border-border bg-background px-2 text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          onChange={(event) => {
            const next = event.target.value === 'en' ? 'en' : 'uk';
            setPreferenceCookie('gym-locale', next, 31_536_000);
            router.refresh();
          }}
        >
          <option value="uk">Українська</option>
          <option value="en">English</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>{t.theme}</span>
        <select
          aria-label={t.theme}
          value={theme}
          className="min-h-11 rounded-lg border border-border bg-background px-2 text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          onChange={(event) => {
            const next = parseThemePreference(event.target.value);
            document.documentElement.classList.remove('light', 'dark');
            if (next !== 'system') document.documentElement.classList.add(next);
            setPreferenceCookie(THEME_COOKIE_NAME, next, THEME_COOKIE_MAX_AGE_SECONDS);
            setTheme(next);
          }}
        >
          <option value="system">{t.system}</option>
          <option value="light">{t.light}</option>
          <option value="dark">{t.dark}</option>
        </select>
      </label>
    </div>
  );
}
