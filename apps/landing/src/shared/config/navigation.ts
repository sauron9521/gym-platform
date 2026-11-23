export const mainNavigation = [
  { label: 'Можливості', href: '/features' },
  { label: 'Спортсменам', href: '/for-athletes' },
  { label: 'Тренерам', href: '/for-trainers' },
  { label: 'Про проєкт', href: '/about' },
] as const;

export const applicationNavigation = [
  { label: 'OVRANTO Athlete Web', href: '/apps/web' },
  { label: 'OVRANTO Athlete Mobile', href: '/apps/mobile' },
  { label: 'OVRANTO Coach Web', href: '/for-trainers' },
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
