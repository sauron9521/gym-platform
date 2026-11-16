import { useLocalSearchParams } from 'expo-router';

import { WorkoutDetailsScreen } from '@/screens/workouts/ui/workout-details-screen';

export default function WorkoutDetailsRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  return <WorkoutDetailsScreen id={params.id} />;
}
