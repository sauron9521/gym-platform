import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMobileTheme } from '@/shared/config/theme-provider';

import { WorkoutDetailsScreen } from '@/screens/workouts/ui/workout-details-screen';

export default function WorkoutDetailsRoute() {
  const { palette } = useMobileTheme();
  const params = useLocalSearchParams<{ id: string }>();
  return (
    <SafeAreaView
      edges={['left', 'right', 'bottom']}
      style={{ flex: 1, backgroundColor: palette.background }}
    >
      <WorkoutDetailsScreen key={params.id} id={params.id} />
    </SafeAreaView>
  );
}
