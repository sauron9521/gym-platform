/** Copy catalog for future locale routes; Ukrainian URLs remain stable for now. */
export const messages = {
  uk: {
    navigation: {
      features: 'Можливості',
      athletes: 'Спортсменам',
      trainers: 'Тренерам',
      about: 'Про проєкт',
      apps: 'Застосунки',
    },
    common: {
      inDevelopment: 'У розробці',
      learnMore: 'Дізнатися більше',
      allApplications: 'Усі застосунки',
    },
    home: {
      title: 'Тренуйся розумніше. Прогресуй далі.',
      description: 'Єдина платформа для спортсменів і тренерів.',
    },
  },
  en: {
    navigation: {
      features: 'Features',
      athletes: 'For athletes',
      trainers: 'For trainers',
      about: 'About',
      apps: 'Applications',
    },
    common: {
      inDevelopment: 'In development',
      learnMore: 'Learn more',
      allApplications: 'All applications',
    },
    home: {
      title: 'Train smarter. Progress further.',
      description: 'One platform for athletes and trainers.',
    },
  },
} as const;

export type SupportedLocale = keyof typeof messages;
export const defaultLocale: SupportedLocale = 'uk';

export function isSupportedLocale(value: string): value is SupportedLocale {
  return value === 'uk' || value === 'en';
}

export function getMessages(locale: SupportedLocale) {
  return messages[locale];
}
