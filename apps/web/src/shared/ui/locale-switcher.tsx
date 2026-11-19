'use client';

import { isLocale, type Locale } from '@gym/i18n';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

type LocaleSwitcherProps = {
  disabled?: boolean;
  error?: string | null;
  onLocaleChange?: (locale: Locale) => void;
};

/** Same-site preference for guests, and after confirmed account updates. */
export function rememberLocale(locale: Locale) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `gym-locale=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}

/** The shared select stays independent of account/profile feature code. */
export function LocaleSwitcher({ disabled, error, onLocaleChange }: LocaleSwitcherProps) {
  const locale = useLocale();
  const t = useTranslations('common');
  const router = useRouter();

  return (
    <span className="inline-flex flex-col gap-1">
      <select
        aria-label={t('language')}
        aria-invalid={Boolean(error) || undefined}
        className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground disabled:opacity-60"
        value={locale}
        disabled={disabled}
        onChange={(event) => {
          const next = event.target.value;
          if (!isLocale(next) || next === locale) return;
          if (onLocaleChange) {
            onLocaleChange(next);
          } else {
            rememberLocale(next);
            router.refresh();
          }
        }}
      >
        <option value="uk">Українська</option>
        <option value="en">English</option>
      </select>
      {error ? (
        <span role="alert" className="max-w-64 text-xs text-destructive">
          {error}
        </span>
      ) : null}
    </span>
  );
}
