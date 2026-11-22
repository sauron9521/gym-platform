'use client';

import { useState } from 'react';

import {
  parseThemePreference,
  THEME_COOKIE_MAX_AGE_SECONDS,
  THEME_COOKIE_NAME,
  type ThemePreference,
} from '@/shared/lib/theme-preference';

const copy = {
  uk: {
    label: 'Тема інтерфейсу',
    system: 'Системна',
    light: 'Світла',
    dark: 'Темна',
  },
  en: {
    label: 'Appearance theme',
    system: 'System',
    light: 'Light',
    dark: 'Dark',
  },
} as const;

/**
 * Root layout reads the same cookie on the server to avoid a theme flash.
 * When "system" is selected, CSS media queries follow OS changes without JS.
 */
export function ThemeSwitcher({
  initialPreference,
  locale,
}: {
  initialPreference: ThemePreference;
  locale: string;
}) {
  const [preference, setPreference] = useState(initialPreference);
  const labels = locale === 'en' ? copy.en : copy.uk;

  return (
    <select
      data-slot="landing-theme-switcher"
      aria-label={labels.label}
      className="h-11 w-[91px] shrink-0 rounded-xl border border-border bg-card px-2 text-xs font-semibold text-foreground shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:w-[112px] sm:px-3"
      value={preference}
      onChange={(event) => {
        const next = parseThemePreference(event.target.value);
        const root = document.documentElement;
        root.classList.remove('light', 'dark');
        if (next !== 'system') root.classList.add(next);

        const secure = window.location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = `${THEME_COOKIE_NAME}=${next}; Path=/; Max-Age=${THEME_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
        setPreference(next);
      }}
    >
      <option value="system">{labels.system}</option>
      <option value="light">{labels.light}</option>
      <option value="dark">{labels.dark}</option>
    </select>
  );
}
