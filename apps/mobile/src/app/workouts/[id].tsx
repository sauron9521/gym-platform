import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { palette } from '@/shared/config/theme';

import { WorkoutDetailsScreen } from '@/screens/workouts/ui/workout-details-screen';

export default function WorkoutDetailsRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  return (
    <SafeAreaView
      edges={['left', 'right', 'bottom']}
      style={{ flex: 1, backgroundColor: palette.background }}
    >
      <WorkoutDetailsScreen id={params.id} />
    </SafeAreaView>
  );
}
