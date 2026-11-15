import { pageMetadata } from '@/shared/lib/seo';
import { IntroPage } from '@/widgets/content/ui/intro-page';

export const metadata = pageMetadata({
  title: "Можливості",
  description: "Досліджуйте можливості Gym Platform: бібліотеку вправ, планування тренувань, програми та відстеження результатів.",
  path: '/features',
});

export default function Page() {
  return (
    <IntroPage
      eyebrow={"Можливості платформи"}
      title={"Тренування, програми й прогрес"}
      description={"Досліджуйте можливості Gym Platform: бібліотеку вправ, планування тренувань, програми та відстеження результатів."}
    />
  );
}
