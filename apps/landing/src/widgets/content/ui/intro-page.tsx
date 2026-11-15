import Link from 'next/link';

type IntroPageProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function IntroPage({ eyebrow, title, description }: IntroPageProps) {
  return (
    <main
      id="main-content"
      className="relative isolate mx-auto w-full max-w-6xl flex-1 px-6 py-20 sm:py-28"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-10 right-6 -z-10 size-64 rounded-full bg-primary/10 blur-3xl"
      />
      <span
        className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-bold tracking-[0.18em] text-primary uppercase"
      >
        {eyebrow}
      </span>
      <h1 className="mt-8 max-w-4xl text-4xl font-bold tracking-tight text-balance sm:text-6xl">
        {title}
      </h1>
      <p className="mt-7 max-w-2xl text-lg leading-8 text-muted-foreground">{description}</p>
      <p
        className="mt-10 max-w-2xl border-l-2 border-primary pl-5 text-sm leading-7 text-muted-foreground"
      >
        Цей розділ готується. Детальний опис можливостей і матеріали додамо окремо.
      </p>
      <Link
        href="/"
        className="mt-10 inline-flex text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
      >
        На головну
      </Link>
    </main>
  );
}
