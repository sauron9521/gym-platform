import '../../global.css';

import { Stack } from 'expo-router';
import { useIntl } from 'react-intl';
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
import { AppSettingsProvider } from '@/features/app-settings/model/app-settings-context';
import { AccountLocaleSync } from '@/features/profile/ui/account-locale-sync';

function Navigation() {
  const { account, capabilities, restoring } = useAuth();
  const intl = useIntl();
  const t = (key: string) => intl.formatMessage({ id: `mobile.navigation.${key}` });
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
          <Stack.Screen name="(tabs)" options={{ title: 'OVRANTO' }} />
          <Stack.Screen
            name="profile/edit"
            options={{ headerShown: true, title: t('editProfile') }}
          />
          <Stack.Screen
            name="profile/settings"
            options={{ headerShown: true, title: t('appSettings') }}
          />
          <Stack.Screen
            name="exercises/index"
            options={{ headerShown: true, title: t('exercises') }}
          />
          <Stack.Screen name="workouts/[id]" options={{ headerShown: true, title: t('workout') }} />
        </Stack.Protected>
        <Stack.Protected guard={hasAthleteAccess(capabilities)}>
          <Stack.Screen
            name="programs/index"
            options={{
              headerShown: true,
              title: intl.formatMessage({ id: 'mobile.tabs.myPrograms' }),
            }}
          />
          <Stack.Screen
            name="progress/exercises/[id]"
            options={{ headerShown: true, title: t('exerciseProgress') }}
          />
          <Stack.Screen name="programs/[id]" options={{ headerShown: true, title: t('program') }} />
          <Stack.Screen
            name="workouts/new"
            options={{ headerShown: true, title: t('newWorkout') }}
          />
        </Stack.Protected>
        <Stack.Protected guard={hasTrainerAccess(capabilities)}>
          <Stack.Screen
            name="trainer/athletes"
            options={{ headerShown: true, title: t('athletes') }}
          />
        </Stack.Protected>
        <Stack.Protected guard={!account || !capabilities}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
      </Stack>
      <StatusBar style="light" />
      <OfflineBanner />
      {restoring || (account && !capabilities) ? (
        <View accessibilityLabel={t('restoring')} style={styles.loadingOverlay}>
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
                  <AppSettingsProvider>
                    <Navigation />
                  </AppSettingsProvider>
                </AuthProvider>
              </MobileErrorBoundary>
            </MobileQueryProvider>
          </LocaleProvider>
        </GluestackUIProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
