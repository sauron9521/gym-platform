import type { Metadata } from 'next';

import { DashboardScreen } from '@/widgets/dashboard/ui/dashboard-screen';

export const metadata: Metadata = {
  title: 'Кабінет | Gym Platform',
};

export default function DashboardPage() {
  // The client gate displays no private data until GET /users/me succeeds.
  // Backend authentication/authorization is the real security boundary.
  return <DashboardScreen />;
}
