import type { Locale } from '@gym/i18n';

export const trainerCopy = {
  uk: {
    skip: 'Перейти до вмісту',
    navigation: 'Навігація тренера',
    overview: 'Огляд',
    athletes: 'Клієнти',
    programs: 'Програми',
    builder: 'Редактор програм',
    comingSoon: 'Незабаром',
    menuOpen: 'Відкрити меню',
    menuClose: 'Закрити меню',
    pageEyebrow: 'Тренерська платформа',
    pageTitle: 'Простір тренера готується',
    pageDescription:
      'OVRANTO Trainer отримав власну основу. Клієнти, програми та керування тренуваннями з’являться після впровадження серверної перевірки прав.',
    status: 'Підготовка застосунку',
    statusDescription: 'Ця сторінка не відображає приватні дані та не підтверджує тренерський доступ.',
    language: 'Мова',
    theme: 'Тема',
    system: 'Системна',
    light: 'Світла',
    dark: 'Темна',
    unavailable: 'Зараз недоступно',
    retry: 'Спробувати ще раз',
    notFound: 'Сторінку не знайдено',
    returnHome: 'На головну',
  },
  en: {
    skip: 'Skip to content',
    navigation: 'Trainer navigation',
    overview: 'Overview',
    athletes: 'Clients',
    programs: 'Programs',
    builder: 'Program builder',
    comingSoon: 'Coming soon',
    menuOpen: 'Open menu',
    menuClose: 'Close menu',
    pageEyebrow: 'Trainer platform',
    pageTitle: 'Your trainer workspace is taking shape',
    pageDescription:
      'OVRANTO Trainer now has its own foundation. Clients, programs and training management will follow verified server-side access controls.',
    status: 'Application setup',
    statusDescription: 'This page contains no private data and does not confirm trainer access.',
    language: 'Language',
    theme: 'Theme',
    system: 'System',
    light: 'Light',
    dark: 'Dark',
    unavailable: 'Temporarily unavailable',
    retry: 'Try again',
    notFound: 'Page not found',
    returnHome: 'Back to overview',
  },
} as const satisfies Record<Locale, Record<string, string>>;

export function getTrainerCopy(locale: Locale) {
  return trainerCopy[locale];
}
