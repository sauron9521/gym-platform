import { useLocalSearchParams } from 'expo-router';

import { ExerciseProgressScreen } from '@/screens/progress/ui/exercise-progress-screen';

export default function ExerciseProgressRoute() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  return <ExerciseProgressScreen id={typeof id === 'string' ? id : ''} />;
}
