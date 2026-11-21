import '../../global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/features/auth/model/auth-context';
import {
  hasAthleteAccess,
  hasTrainerAccess,
  hasMobileAccess,
} from '@/features/auth/model/account-capabilities';
import { GluestackUIProvider } from '@/shared/ui/gluestack/gluestack-ui-provider';
import { MobileQueryProvider } from '@/shared/api/query-provider';
import { palette } from '@/shared/config/theme';
import { OfflineBanner } from '@/shared/ui/offline-banner';
import { MobileErrorBoundary } from '@/shared/ui/mobile-error-boundary';
import { LocaleProvider } from '@/shared/i18n/locale-provider';
import { AccountLocaleSync } from '@/features/profile/ui/account-locale-sync';

function Navigation() {
  const { account, capabilities, restoring } = useAuth();
  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          headerStyle: { backgroundColor: palette.surface },
          headerTintColor: palette.text,
          headerTitleStyle: { color: palette.text },
          headerBackButtonDisplayMode: 'minimal',
          headerShadowVisible: false,
          contentStyle: { backgroundColor: palette.background },
        }}
      >
        <Stack.Protected guard={Boolean(account && hasMobileAccess(capabilities))}>
          <Stack.Screen name="(tabs)" options={{ title: 'Gym Platform' }} />
          <Stack.Screen
            name="profile/edit"
            options={{ headerShown: true, title: 'Редагувати профіль' }}
          />
          <Stack.Screen name="exercises/index" options={{ headerShown: true, title: 'Вправи' }} />
          <Stack.Screen name="workouts/[id]" options={{ headerShown: true, title: 'Тренування' }} />
        </Stack.Protected>
        <Stack.Protected guard={hasAthleteAccess(capabilities)}>
          <Stack.Screen
            name="progress/index"
            options={{ headerShown: true, title: 'Мій прогрес' }}
          />
          <Stack.Screen
            name="progress/exercises/[id]"
            options={{ headerShown: true, title: 'Прогрес вправи' }}
          />
          <Stack.Screen name="programs/[id]" options={{ headerShown: true, title: 'Програма' }} />
          <Stack.Screen
            name="workouts/new"
            options={{ headerShown: true, title: 'Нове тренування' }}
          />
        </Stack.Protected>
        <Stack.Protected guard={hasTrainerAccess(capabilities)}>
          <Stack.Screen
            name="trainer/athletes"
            options={{ headerShown: true, title: 'Мої підопічні' }}
          />
        </Stack.Protected>
        <Stack.Protected guard={!account || !capabilities}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
      </Stack>
      <StatusBar style="light" />
      <OfflineBanner />
      {restoring || (account && !capabilities) ? (
        <View accessibilityLabel="Відновлення сесії" style={styles.loadingOverlay}>
          <ActivityIndicator color={palette.primary} size="large" />
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: palette.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <GluestackUIProvider mode="dark">
          <LocaleProvider>
            <MobileQueryProvider>
              <MobileErrorBoundary>
                <AuthProvider>
                  <AccountLocaleSync />
                  <Navigation />
                </AuthProvider>
              </MobileErrorBoundary>
            </MobileQueryProvider>
          </LocaleProvider>
        </GluestackUIProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
