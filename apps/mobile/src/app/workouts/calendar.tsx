import { useAuth } from '@/features/auth/model/auth-context';
import { hasAthleteAccess } from '@/features/auth/model/account-capabilities';
import { WorkoutCalendarScreen } from '@/screens/workouts/ui/workout-calendar-screen';

export default function WorkoutCalendarRoute() {
  const { account, capabilities } = useAuth();
  if (!account || !hasAthleteAccess(capabilities)) return null;
  return <WorkoutCalendarScreen key={account.id} />;
}
