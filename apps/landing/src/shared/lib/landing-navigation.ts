import { defaultLocale, getMessages, type Locale } from '@gym/i18n';
import { applicationNavigation, mainNavigation } from '@/shared/config/navigation';

/** Stable public route paths, localized labels only. Prefix routes in I18N-19. */
export function getLandingNavigation(locale: Locale = defaultLocale) {
  const nav = getMessages(locale).navigation;
  const shell = getMessages(locale).landing.shell;
  const labels: Record<(typeof mainNavigation)[number]['href'], string> = {
    '/features': nav.features,
    '/for-athletes': nav.athletes,
    '/for-trainers': nav.trainers,
    '/about': nav.about,
  };
  return {
    main: mainNavigation.map(({ href }) => ({ href, label: labels[href] })),
    applications: applicationNavigation.map(({ href, label }) => ({ href, label })),
    productDirectoryLabel: locale === 'en' ? 'Products' : 'Продукти',
    nav,
    shell,
  };
}
