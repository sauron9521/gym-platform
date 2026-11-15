import { siteDescription } from '@/shared/lib/seo';
import { HomeScreen } from '@/widgets/home/ui/home-screen';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  description: siteDescription,
};

export default function HomePage() {
  return <HomeScreen />;
}
