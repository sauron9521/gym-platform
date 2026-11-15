import { pageMetadata } from '@/shared/lib/seo';
import { IntroPage } from '@/widgets/content/ui/intro-page';

export const metadata = pageMetadata({
  title: "Спортсменам",
  description: "Плануйте тренування, ведіть журнал вправ і поступово відстежуйте свій прогрес разом із Gym Platform.",
  path: '/for-athletes',
});

export default function Page() {
  return (
    <IntroPage
      eyebrow={"Для спортсменів"}
      title={"Від тренування до результату"}
      description={"Плануйте тренування, ведіть журнал вправ і поступово відстежуйте свій прогрес разом із Gym Platform."}
    />
  );
}
