import { useAuth } from '@/features/auth/model/auth-context';
import { hasAthleteAccess } from '@/features/auth/model/account-capabilities';
import { CreateWorkoutScreen } from '@/screens/workouts/ui/create-workout-screen';

export default function CreateWorkoutRoute() {
  const { account, capabilities } = useAuth();
  if (!account || !hasAthleteAccess(capabilities)) return null;
  return <CreateWorkoutScreen key={account.id} />;
}
