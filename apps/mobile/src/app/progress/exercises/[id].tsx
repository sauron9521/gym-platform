import { useLocalSearchParams } from 'expo-router';
import { ExerciseProgressScreen } from '@/screens/progress/ui/exercise-progress-screen';

export default function ExerciseProgressRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ExerciseProgressScreen id={id ?? ''} />;
}
