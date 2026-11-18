import Link from 'next/link';

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@gym/ui-web';

import type { AuthenticatedUser } from '@/shared/api/server-session';

type DashboardHomeProps = {
  email: string;
  displayName: string;
  role: AuthenticatedUser['role'];
  isSigningOut: boolean;
  signOutError: string | null;
  onSignOut: () => void;
};

type Shortcut = {
  href: string;
  title: string;
  description: string;
};

export function getDashboardShortcuts(role: AuthenticatedUser['role']): Shortcut[] {
  const shortcuts: Shortcut[] = [
    {
      href: '/exercises',
      title: 'Каталог вправ',
      description: 'Знаходь вправи для своїх тренувань.',
    },
    {
      href: '/profile',
      title: 'Мій профіль',
      description: 'Переглядай і оновлюй особисті дані.',
    },
  ];

  if (role === 'ATHLETE') {
    shortcuts.push(
      {
        href: '/athlete/programs',
        title: 'Мої програми',
        description: 'Переглядай призначені тренувальні програми.',
      },
      {
        href: '/athlete/trainers',
        title: 'Мої тренери',
        description: 'Переглядай зв’язки зі своїми тренерами.',
      },
    );
  } else if (role === 'TRAINER') {
    shortcuts.push(
      {
        href: '/trainer/programs',
        title: 'Тренувальні програми',
        description: 'Керуй програмами для своїх спортсменів.',
      },
      {
        href: '/trainer/athletes',
        title: 'Мої підопічні',
        description: 'Переглядай спортсменів, із якими працюєш.',
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
}: DashboardHomeProps) {
  const shortcuts = getDashboardShortcuts(role);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            OVRANTO · PERFORMANCE PLATFORM
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Вітаємо, {displayName}!
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
            {isSigningOut ? 'Вихід…' : 'Вийти'}
          </Button>
          {signOutError && (
            <p role="alert" className="max-w-xs text-sm text-destructive">
              {signOutError}
            </p>
          )}
        </div>
      </header>

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
            Твій наступний крок
          </p>
          <h2
            id="dashboard-next-step"
            className="text-2xl font-semibold tracking-tight sm:text-3xl"
          >
            Плануй тренування. Відстежуй прогрес.
          </h2>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Створи тренування, додай вправи й підходи. Записи та їхній стан можна переглядати у
            твоєму журналі.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button
              asChild
              size="touch"
              className="bg-[var(--brand-teal)] text-[var(--set-active-foreground)] hover:opacity-90"
            >
              <Link href="/workouts/new">Створити тренування</Link>
            </Button>
            <Button asChild size="touch" variant="outline">
              <Link href="/workouts">Відкрити журнал</Link>
            </Button>
          </div>
        </div>
      </section>

      <section aria-labelledby="dashboard-shortcuts" className="space-y-4">
        <div className="space-y-1">
          <h2 id="dashboard-shortcuts" className="text-xl font-semibold tracking-tight">
            Швидкий доступ
          </h2>
          <p className="text-sm text-muted-foreground">Перейди до потрібного розділу OVRANTO.</p>
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
                  Відкрити {shortcut.title.toLowerCase()}
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
