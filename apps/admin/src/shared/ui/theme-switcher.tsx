'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  THEME_COOKIE_MAX_AGE_SECONDS,
  THEME_COOKIE_NAME,
  type ThemePreference,
} from '@/shared/lib/theme-preference';

type ThemeSwitcherProps = {
  initialTheme: ThemePreference;
  labels: {
    title: string;
    system: string;
    light: string;
    dark: string;
  };
};

export function ThemeSwitcher({ initialTheme, labels }: ThemeSwitcherProps) {
  const [theme, setTheme] = useState(initialTheme);
  const router = useRouter();

  function changeTheme(value: string) {
    if (value !== 'system' && value !== 'light' && value !== 'dark') return;
    setTheme(value);
    document.cookie = `${THEME_COOKIE_NAME}=${value}; Path=/; Max-Age=${THEME_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
    document.documentElement.classList.remove('light', 'dark');
    if (value !== 'system') document.documentElement.classList.add(value);
    router.refresh();
  }

  return (
    <select
      aria-label={labels.title}
      className="min-h-10 max-w-32 rounded-lg border border-border bg-card px-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      value={theme}
      onChange={(event) => changeTheme(event.target.value)}
    >
      <option value="system">{labels.system}</option>
      <option value="light">{labels.light}</option>
      <option value="dark">{labels.dark}</option>
    </select>
  );
}
