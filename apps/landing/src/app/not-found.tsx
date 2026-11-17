import Link from 'next/link';

import { Container, MarketingSection } from '@/shared/ui/marketing';

export default function NotFound() {
  return (
    <main id="main-content" className="flex-1">
      <MarketingSection>
        <Container>
          <p className="text-sm font-bold tracking-widest text-primary uppercase">404</p>
          <h1 className="mt-6 max-w-2xl text-4xl font-bold tracking-tight sm:text-6xl">
            Цю сторінку не знайдено
          </h1>
          <p className="mt-6 max-w-2xl leading-7 text-muted-foreground">
            Можливо, адресу змінено. Повернися до презентації Gym Platform.
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex rounded-md font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          >
            На головну
          </Link>
        </Container>
      </MarketingSection>
    </main>
  );
}
