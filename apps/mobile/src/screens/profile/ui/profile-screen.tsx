import { StyleSheet, Text, View } from 'react-native';

import { palette } from '@/shared/config/theme';

export function ProfileScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.heading}>Athlete profile</Text>
        <Text style={styles.description}>
          Authentication and profile data will be connected to the NestJS API in a later PR.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
    padding: 24,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    gap: 12,
  },
  heading: {
    color: palette.text,
    fontSize: 24,
    fontWeight: '700',
  },
  description: {
    color: palette.muted,
    lineHeight: 22,
    fontSize: 15,
  },
});
