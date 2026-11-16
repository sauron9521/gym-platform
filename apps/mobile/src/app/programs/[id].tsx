import { useLocalSearchParams } from 'expo-router';

import { ProgramDetailsScreen } from '@/screens/programs/ui/program-details-screen';

export default function ProgramDetailsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProgramDetailsScreen id={id} />;
}
