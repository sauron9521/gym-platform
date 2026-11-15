import Link from 'next/link';

import { Button } from '@/shared/ui/button';

const applications = [
  { title: 'Вебзастосунок', description: 'Тренування, вправи та прогрес.', status: 'У розробці' },
  { title: 'Для тренерів', description: 'Програми для спортсменів.', status: 'У розробці' },
  { title: 'Мобільний застосунок', description: 'Тренування зі смартфона.', status: 'У розробці' },
] as const;

const introduction =
  'Створюємо єдину екосистему для спортсменів і тренерів: від планування до результатів.';

export function HomeScreen() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl justify-between px-6 py-5">
          <Link href="/" className="text-lg font-semibold">
            Gym Platform
          </Link>
          <Link href="#platform" className="text-sm text-muted-foreground">
            Про платформу
          </Link>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-6 py-24">
          <p className="text-sm font-semibold uppercase tracking-widest">Gym Platform</p>
          <h1 className="mt-5 max-w-4xl text-4xl font-semibold sm:text-6xl">
            Одна платформа для тренувань і прогресу
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">{introduction}</p>
          <div className="mt-8">
            <Button asChild size="lg">
              <Link href="#platform">Огляд платформи</Link>
            </Button>
          </div>
        </section>

        <section id="platform" className="border-t bg-muted/30">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <h2 className="text-3xl font-semibold">Застосунки платформи</h2>
            <p className="mt-4 text-muted-foreground">
              Детальні сторінки та структуру сайту погодимо окремо.
            </p>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {applications.map((item) => (
                <article key={item.title} className="rounded-xl border bg-card p-6">
                  <p className="text-xs text-muted-foreground">{item.status}</p>
                  <h3 className="mt-4 text-xl font-semibold">{item.title}</h3>
                  <p className="mt-3 text-muted-foreground">{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t px-6 py-8 text-center text-sm text-muted-foreground">
        Gym Platform · Презентаційний сайт у розробці
      </footer>
    </div>
  );
}
