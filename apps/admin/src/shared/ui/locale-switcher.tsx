'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

/** Admin UI only; account permissions do not depend on the chosen locale. */
export function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations('common');
  const router = useRouter();
  return (
    <select
      aria-label={t('language')}
      className="rounded border border-border bg-background px-2 py-1 text-sm"
      value={locale}
      onChange={(event) => {
        const next = event.target.value;
        if (next !== 'uk' && next !== 'en') return;
        document.cookie = `gym-locale=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
        router.refresh();
      }}
    >
      <option value="uk">Українська</option>
      <option value="en">English</option>
    </select>
  );
}
