import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { palette } from '@/shared/config/theme';
import { StatusTile } from '@/shared/ui/status-tile';

export function HomeScreen() {
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      style={styles.container}
      accessibilityLabel="Gym Platform home"
    >
      <Text style={styles.eyebrow}>GYM PLATFORM</Text>
      <Text style={styles.title}>Your training starts here.</Text>
      <Text style={styles.description}>
        Mobile is ready for development. Next: authentication, training plans, workouts and progress
        tracking.
      </Text>

      <View style={styles.tiles}>
        <StatusTile label="Mobile" detail="Expo Router navigation" status="Ready" />
        <StatusTile label="API" detail="NestJS integration" status="Planned" />
        <StatusTile label="Programs" detail="Workouts and exercises" status="Planned" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: palette.background,
    flex: 1,
  },
  content: {
    gap: 18,
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  eyebrow: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
  title: {
    color: palette.text,
    fontSize: 34,
    fontWeight: '700',
    lineHeight: 40,
  },
  description: {
    color: palette.muted,
    fontSize: 16,
    lineHeight: 24,
  },
  tiles: {
    gap: 12,
    marginTop: 24,
  },
});
