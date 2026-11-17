import Link from 'next/link';

import { Button } from '@/shared/ui/button';
import {
  CallToAction,
  Container,
  FeatureCard,
  MarketingSection,
  SectionHeading,
} from '@/shared/ui/marketing';

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

const milestones = [
  { number: '01', title: 'Обери вправи', detail: 'Збери власну бібліотеку рухів.' },
  { number: '02', title: 'Склади план', detail: 'Організуй тренування та підходи.' },
  { number: '03', title: 'Відстежуй результат', detail: 'Аналізуй свій тренувальний шлях.' },
] as const;

export function HomeScreen() {
  return (
    <main id="main-content" className="flex-1">
      <section className="relative isolate overflow-hidden border-b border-border/70">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 right-0 -z-10 h-full w-2/3 bg-[radial-gradient(ellipse_at_top_right,oklch(0.87_0.2_125/0.15),transparent_65%)]"
        />
        <Container className="grid items-center gap-14 py-24 sm:py-32 lg:grid-cols-2">
          <div>
            <p className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-bold tracking-widest text-primary uppercase">
              Gym Platform · Рання стадія розробки
            </p>
            <h1 className="mt-8 text-5xl font-bold tracking-tight text-balance sm:text-7xl">
              Тренуйся розумніше. <span className="text-primary">Прогресуй далі.</span>
            </h1>
            <p className="mt-7 text-lg leading-8 text-muted-foreground">
              Платформа для спортсменів і тренерів: вправи, тренувальні програми та прогрес — в
              одній екосистемі.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/features">Дізнатися більше</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/apps">Переглянути застосунки</Link>
              </Button>
            </div>
            <p className="mt-6 text-xs text-muted-foreground">
              Платформа в активній розробці. Можливості з’являються поступово.
            </p>
          </div>
          <div
            role="img"
            aria-label="Умовний макет тренувального плану. Демонстрація дизайну, не реальні дані спортсмена"
            className="rounded-3xl border border-border bg-card p-5 shadow-2xl shadow-black/20"
          >
            <div className="flex items-center justify-between border-b border-border pb-4">
              <span className="text-sm font-bold">Тренувальний план</span>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
                Макет
              </span>
            </div>
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {['Вправи', 'Підходи', 'Прогрес'].map((label, index) => (
                <div key={label} className="rounded-xl bg-secondary p-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-4 text-2xl font-bold text-primary">0{index + 1}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 space-y-3" aria-hidden="true">
              {[65, 83, 45].map((value) => (
                <div key={value} className="h-3 rounded-full bg-muted">
                  <div className="h-3 rounded-full bg-primary/70" style={{ width: value + '%' }} />
                </div>
              ))}
            </div>
            <p className="mt-6 text-xs text-muted-foreground">
              Демонстрація дизайн-напрямку, не реальні дані спортсмена.
            </p>
          </div>
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

      <MarketingSection tone="subtle" aria-labelledby="workflow">
        <Container>
          <SectionHeading
            id="workflow"
            eyebrow="Як це працює"
            title="Від плану до наступного результату"
            description="Простий шлях до більш усвідомлених тренувань."
          />
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {milestones.map((step) => (
              <div key={step.number} className="rounded-2xl border border-border bg-card p-7">
                <span className="text-sm font-bold text-primary">{step.number}</span>
                <h3 className="mt-5 text-xl font-semibold">{step.title}</h3>
                <p className="mt-3 leading-7 text-muted-foreground">{step.detail}</p>
              </div>
            ))}
          </div>
        </Container>
      </MarketingSection>

      <CallToAction
        title="Відкрий можливості Gym Platform"
        description="Дізнайся про продукти платформи та слідкуй за їх розвитком."
        primary={{ href: '/apps', label: 'Переглянути продукти' }}
        secondary={{ href: '/about', label: 'Про проєкт' }}
      />
    </main>
  );
}
