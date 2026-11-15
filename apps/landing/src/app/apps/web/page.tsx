import { pageMetadata } from '@/shared/lib/seo';
import { IntroPage } from '@/widgets/content/ui/intro-page';

export const metadata = pageMetadata({
  title: "Web",
  description: "Вебзастосунок Gym Platform розробляється для керування тренуваннями, вправами та тренувальними програмами.",
  path: '/apps/web',
});

export default function Page() {
  return (
    <IntroPage
      eyebrow={"Вебзастосунок"}
      title={"Gym Platform у браузері"}
      description={"Вебзастосунок Gym Platform розробляється для керування тренуваннями, вправами та тренувальними програмами."}
    />
  );
}
