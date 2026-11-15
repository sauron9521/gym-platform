import { pageMetadata } from '@/shared/lib/seo';
import { IntroPage } from '@/widgets/content/ui/intro-page';

export const metadata = pageMetadata({
  title: "Про проєкт",
  description: "Gym Platform — проєкт єдиної цифрової екосистеми, що поєднує спортсменів, тренерів і зручні інструменти для тренувань.",
  path: '/about',
});

export default function Page() {
  return (
    <IntroPage
      eyebrow={"Про Gym Platform"}
      title={"Платформа, яку ми розвиваємо"}
      description={"Gym Platform — проєкт єдиної цифрової екосистеми, що поєднує спортсменів, тренерів і зручні інструменти для тренувань."}
    />
  );
}
