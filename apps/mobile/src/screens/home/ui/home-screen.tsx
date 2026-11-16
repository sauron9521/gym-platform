import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { palette } from '@/shared/config/theme';
import { StatusTile } from '@/shared/ui/status-tile';
import { Box } from '@/shared/ui/gluestack/box';
import { Button, ButtonText } from '@/shared/ui/gluestack/button';
import { Text as UiText } from '@/shared/ui/gluestack/text';

export function HomeScreen() {
  const router = useRouter();

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

      <Box className="gap-3 rounded-xl border border-border bg-card p-4">
        <UiText className="text-lg font-semibold text-foreground">Мобільний інтерфейс</UiText>
        <UiText className="text-muted-foreground">
          Базові компоненти gluestack-ui v5 готові для наступних функцій Gym Platform.
        </UiText>
        <Button onPress={() => router.push('/progress')} accessibilityLabel="Переглянути прогрес">
          <ButtonText>Мій прогрес</ButtonText>
        </Button>
        <Button onPress={() => router.push('/profile')} accessibilityLabel="Відкрити профіль">
          <ButtonText>Відкрити профіль</ButtonText>
        </Button>
      </Box>
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
