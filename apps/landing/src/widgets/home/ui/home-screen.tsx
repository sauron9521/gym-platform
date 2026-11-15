import { Button } from '@/shared/ui/button';

const applications = [
  {
    title: 'Вебзастосунок',
    description: 'Особистий кабінет для роботи з тренуваннями, вправами та власним прогресом.',
    status: 'У розробці',
  },
  {
    title: 'Інструменти тренера',
    description: 'Програми тренувань, взаємодія зі спортсменами та керування планами.',
    status: 'У розробці',
  },
  {
    title: 'Мобільний застосунок',
    description: 'Тренування й відстеження результатів безпосередньо зі смартфона.',
    status: 'У розробці',
  },
] as const;

export function HomeScreen() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <a className="text-lg font-semibold tracking-tight" href="/" aria-label="Gym Platform">
            Gym Platform
          </a>
          <a
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            href="#platform"
          >
            Про платформу
          </a>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
          <p className="text-sm font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            Gym Platform
          </p>
          <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-tight sm:text-6xl">
            Одна платформа для тренувань, тренерів і прогресу.
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-muted-foreground">
            Створюємо екосистему, яка поєднає планування тренувань, бібліотеку вправ,
            роботу з тренером та аналіз результатів. Тут з’являться можливості кожного
            застосунку Gym Platform.
          </p>
          <div className="mt-9">
            <Button asChild size="lg">
              <a href="#platform">Ознайомитися з платформою</a>
            </Button>
          </div>
        </section>

        <section id="platform" className="border-t border-border bg-muted/30">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight">Можливості платформи</h2>
              <p className="mt-4 text-muted-foreground">
                Це початковий огляд. Окремі сторінки, навігацію та детальний опис
                функціоналу погодимо під час наступного етапу.
              </p>
            </div>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {applications.map((application) => (
                <article
                  key={application.title}
                  className="rounded-xl border border-border bg-card p-6 text-card-foreground"
                >
                  <span className="text-xs font-medium text-muted-foreground">
                    {application.status}
                  </span>
                  <h3 className="mt-4 text-xl font-semibold">{application.title}</h3>
                  <p className="mt-3 leading-7 text-muted-foreground">
                    {application.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-7 text-sm text-muted-foreground">
          <span>Gym Platform</span>
          <span>Презентаційний сайт у розробці</span>
        </div>
      </footer>
    </div>
  );
}
