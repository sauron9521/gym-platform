import Link from 'next/link';

import { Button } from '@/shared/ui/button';
import { Container, FeatureCard, MarketingSection, SectionHeading } from '@/shared/ui/marketing';

const audiences = [
  {
    title: 'Для спортсменів',
    description: 'Записуйте тренування, працюйте з вправами й стежте за прогресом.',
    href: '/for-athletes',
    action: 'Можливості спортсмена',
  },
  {
    title: 'Для тренерів',
    description: 'Організовуйте тренувальні програми та взаємодію зі спортсменами.',
    href: '/for-trainers',
    action: 'Можливості тренера',
  },
  {
    title: 'Web і Mobile',
    description: 'Знайомтеся з продуктами, які разом формують Gym Platform.',
    href: '/apps',
    action: 'Усі застосунки',
  },
] as const;

export function HomeScreen() {
  return (
    <main id="main-content" className="flex-1">
      <section className="relative isolate overflow-hidden border-b border-border/70">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 right-0 -z-10 h-full w-2/3 bg-[radial-gradient(ellipse_at_top_right,oklch(0.87_0.2_125/0.15),transparent_65%)]"
        />
        <Container className="py-24 sm:py-32">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-bold tracking-[0.18em] text-primary uppercase">
            <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
            Gym Platform
          </span>
          <h1 className="mt-8 max-w-4xl text-5xl font-bold tracking-tight text-balance sm:text-7xl">
            Тренуйся розумніше. <span className="text-primary">Прогресуй далі.</span>
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-muted-foreground">
            Розвиваємо єдину платформу для спортсменів і персональних тренерів: планування
            тренувань, бібліотека вправ, програми та відстеження прогресу.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/features">Дізнатися більше</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/apps">Переглянути застосунки</Link>
            </Button>
          </div>
          <p className="mt-6 text-xs font-medium text-muted-foreground">
            Платформа в активній розробці. Опис можливостей буде доповнюватися.
          </p>
        </Container>
      </section>

      <MarketingSection aria-labelledby="audiences">
        <Container>
          <SectionHeading
            id="audiences"
            eyebrow="Єдина екосистема"
            title="Платформа для твоїх цілей"
            description="Окремі інструменти для різних сценаріїв тренувань — в одному проєкті."
          />
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {audiences.map(({ title, description, href, action }) => (
              <FeatureCard
                key={href}
                title={title}
                description={description}
                href={href}
                linkLabel={action}
              />
            ))}
          </div>
        </Container>
      </MarketingSection>
    </main>
  );
}
