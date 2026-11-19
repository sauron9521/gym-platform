import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@gym/ui-web';

import type { AuthenticatedUser } from '@/shared/api/server-session';

type DashboardHomeProps = {
  email: string;
  displayName: string;
  role: AuthenticatedUser['role'];
  isSigningOut: boolean;
  signOutError: string | null;
  onSignOut: () => void;
  children?: ReactNode;
  hero?: ReactNode;
};

type Shortcut = {
  href: string;
  title: string;
  description: string;
};

type DashboardShortcutKey =
  | 'shortcuts.exercisesTitle'
  | 'shortcuts.exercisesDescription'
  | 'shortcuts.profileTitle'
  | 'shortcuts.profileDescription'
  | 'shortcuts.athleteProgramsTitle'
  | 'shortcuts.athleteProgramsDescription'
  | 'shortcuts.athleteTrainersTitle'
  | 'shortcuts.athleteTrainersDescription'
  | 'shortcuts.trainerProgramsTitle'
  | 'shortcuts.trainerProgramsDescription'
  | 'shortcuts.trainerAthletesTitle'
  | 'shortcuts.trainerAthletesDescription';

/** Restrict available routes by role; copy comes from the current request locale. */
export function getDashboardShortcuts(
  role: AuthenticatedUser['role'],
  t: (key: DashboardShortcutKey) => string,
): Shortcut[] {
  const shortcuts: Shortcut[] = [
    {
      href: '/exercises',
      title: t('shortcuts.exercisesTitle'),
      description: t('shortcuts.exercisesDescription'),
    },
    {
      href: '/profile',
      title: t('shortcuts.profileTitle'),
      description: t('shortcuts.profileDescription'),
    },
  ];

  if (role === 'ATHLETE') {
    shortcuts.push(
      {
        href: '/athlete/programs',
        title: t('shortcuts.athleteProgramsTitle'),
        description: t('shortcuts.athleteProgramsDescription'),
      },
      {
        href: '/athlete/trainers',
        title: t('shortcuts.athleteTrainersTitle'),
        description: t('shortcuts.athleteTrainersDescription'),
      },
    );
  } else if (role === 'TRAINER') {
    shortcuts.push(
      {
        href: '/trainer/programs',
        title: t('shortcuts.trainerProgramsTitle'),
        description: t('shortcuts.trainerProgramsDescription'),
      },
      {
        href: '/trainer/athletes',
        title: t('shortcuts.trainerAthletesTitle'),
        description: t('shortcuts.trainerAthletesDescription'),
      },
    );
  }

  return shortcuts;
}

/**
 * Pure dashboard presentation. Session checks, query cache clearing, and
 * sign-out requests remain owned by DashboardScreen and server pages.
 */
export function DashboardHome({
  email,
  displayName,
  role,
  isSigningOut,
  signOutError,
  onSignOut,
  children,
  hero,
}: DashboardHomeProps) {
  const t = useTranslations('web.dashboard');
  const locale = useLocale();
  const shortcuts = getDashboardShortcuts(role, t);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            OVRANTO · PERFORMANCE PLATFORM
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {t('greeting', { name: displayName })}
          </h1>
          <p className="break-all text-sm text-muted-foreground">{email}</p>
        </div>
        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            size="touch"
            disabled={isSigningOut}
            onClick={onSignOut}
          >
            {isSigningOut ? t('signingOut') : t('signOut')}
          </Button>
          {signOutError && (
            <p role="alert" className="max-w-xs text-sm text-destructive">
              {signOutError}
            </p>
          )}
        </div>
      </header>

      {hero ?? (
        <section
          aria-labelledby="dashboard-next-step"
          className="relative overflow-hidden rounded-lg border border-border bg-card p-6 shadow-sm sm:p-8 lg:p-10"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-secondary/60 blur-3xl"
          />
          <div className="relative max-w-2xl space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {t('nextStep')}
            </p>
            <h2
              id="dashboard-next-step"
              className="text-2xl font-semibold tracking-tight sm:text-3xl"
            >
              {t('heroTitle')}
            </h2>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {t('heroDescription')}
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                asChild
                size="touch"
                className="bg-[var(--brand-teal)] text-[var(--set-active-foreground)] hover:opacity-90"
              >
                <Link href="/workouts/new">{t('createWorkout')}</Link>
              </Button>
              <Button asChild size="touch" variant="outline">
                <Link href="/workouts">{t('openJournal')}</Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      {children}

      <section aria-labelledby="dashboard-shortcuts" className="space-y-4">
        <div className="space-y-1">
          <h2 id="dashboard-shortcuts" className="text-xl font-semibold tracking-tight">
            {t('shortcutsTitle')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('shortcutsDescription')}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {shortcuts.map((shortcut) => (
            <Card key={shortcut.href} className="flex h-full flex-col">
              <CardHeader>
                <CardTitle>{shortcut.title}</CardTitle>
                <CardDescription>{shortcut.description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <Link
                  href={shortcut.href}
                  className="inline-flex min-h-11 items-center rounded-md text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {t('shortcutLink', { title: shortcut.title.toLocaleLowerCase(locale) })}
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
