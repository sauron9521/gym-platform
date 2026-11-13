import Link from 'next/link';

import { Button } from '@/shared/ui/button';

const applications = [
  { name: 'API', detail: 'NestJS + OpenAPI', state: 'Integrated' },
  { name: 'Web', detail: 'Next.js App Router', state: 'In development' },
  { name: 'Mobile', detail: 'Expo + React Native', state: 'Foundation ready' },
];

export function HomeScreen() {
  return (
    <main className="flex min-h-screen items-center bg-background px-6 py-16 text-foreground">
      <div className="mx-auto w-full max-w-4xl">
        <p className="mb-4 text-sm font-semibold tracking-[0.2em] text-muted-foreground uppercase">
          Gym Platform
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
          One platform. Every workout.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
          Створіть обліковий запис або увійдіть. Зараз доступні базові можливості авторизації;
          профіль, тренування та програми поступово з’являтимуться в кабінеті.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/login">Увійти</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/register">Створити обліковий запис</Link>
          </Button>
        </div>
        <section aria-label="Application status" className="mt-14 grid gap-4 sm:grid-cols-3">
          {applications.map((application) => (
            <div
              key={application.name}
              className="rounded-xl border bg-card p-5 text-card-foreground"
            >
              <p className="text-sm text-muted-foreground">{application.name}</p>
              <h2 className="mt-2 font-semibold">{application.detail}</h2>
              <p className="mt-4 text-xs font-medium text-muted-foreground">{application.state}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
