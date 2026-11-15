export const mainNavigation = [
  { label: 'Можливості', href: '/features' },
  { label: 'Спортсменам', href: '/for-athletes' },
  { label: 'Тренерам', href: '/for-trainers' },
  { label: 'Про проєкт', href: '/about' },
] as const;

export const applicationNavigation = [
  { label: 'Вебзастосунок', href: '/apps/web' },
  { label: 'Мобільний застосунок', href: '/apps/mobile' },
] as const;

export const publicRoutes = [
  '/',
  '/features',
  '/for-athletes',
  '/for-trainers',
  '/apps',
  '/apps/web',
  '/apps/mobile',
  '/about',
] as const;
