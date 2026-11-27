import '../../global.css';

import { useMemo } from 'react';
import { combinePrivateDataLifecycles } from '@/features/auth/model/private-data-lifecycle';
import { offlineDraftLifecycle } from '@/features/workouts/model/offline-draft-lifecycle';

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
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
import {
  createThemedStyles,
  MobileThemeProvider,
  useMobileTheme,
} from '@/shared/config/theme-provider';
import { OfflineBanner } from '@/shared/ui/offline-banner';
import { MobileErrorBoundary } from '@/shared/ui/mobile-error-boundary';
import { LocaleProvider } from '@/shared/i18n/locale-provider';
import { useQueryClient } from '@tanstack/react-query';
import {
  AppSettingsProvider,
  useAppSettings,
} from '@/features/app-settings/model/app-settings-context';
import { RestTimerProvider } from '@/features/workouts/model/rest-timer-provider';
import {
  ReminderRuntime,
  useReminderLifecycle,
} from '@/features/notifications/model/reminder-runtime';
import { AccountLocaleSync } from '@/features/profile/ui/account-locale-sync';

function Navigation() {
  const styles = useStyles();
  const { palette, mode } = useMobileTheme();
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
            name="notifications/index"
            options={{
              headerShown: true,
              title: intl.formatMessage({ id: 'mobile.notifications.title' }),
            }}
          />
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
            name="workouts/calendar"
            options={{ headerShown: true, title: t('workoutCalendar') }}
          />
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
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <OfflineBanner />
      {restoring || (account && !capabilities) ? (
        <View accessibilityLabel={t('restoring')} style={styles.loadingOverlay}>
          <ActivityIndicator color={palette.primary} size="large" />
        </View>
      ) : null}
    </>
  );
}

const useStyles = createThemedStyles((palette) =>
  StyleSheet.create({
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
  }),
);

function WorkoutNavigation() {
  const { account, capabilities } = useAuth();
  const restDuration = useAppSettings((state) => state.settings.restDuration);
  const restSound = useAppSettings((state) => state.settings.restSound);
  const restVibration = useAppSettings((state) => state.settings.restVibration);
  const queryClient = useQueryClient();
  return (
    <RestTimerProvider
      accountId={account && hasMobileAccess(capabilities) ? account.id : null}
      defaultDuration={restDuration}
      feedback={{ sound: restSound, vibration: restVibration }}
      queryClient={queryClient}
    >
      <Navigation />
    </RestTimerProvider>
  );
}

function AuthenticatedApp() {
  const reminders = useReminderLifecycle();
  const privateData = useMemo(
    () => combinePrivateDataLifecycles(offlineDraftLifecycle, reminders),
    [reminders],
  );
  return (
    <AuthProvider privateData={privateData}>
      <AccountLocaleSync />
      <ReminderRuntime reminders={reminders} />
      <AppSettingsProvider>
        <WorkoutNavigation />
      </AppSettingsProvider>
    </AuthProvider>
  );
}

function ThemedApp() {
  const { palette, preference, mode } = useMobileTheme();
  const base = mode === 'dark' ? DarkTheme : DefaultTheme;
  return (
    <ThemeProvider
      value={{
        ...base,
        colors: {
          ...base.colors,
          primary: palette.primary,
          background: palette.background,
          card: palette.surface,
          text: palette.text,
          border: palette.border,
          notification: palette.error,
        },
      }}
    >
      <GluestackUIProvider mode={preference}>
        <LocaleProvider>
          <MobileQueryProvider>
            <MobileErrorBoundary>
              <AuthenticatedApp />
            </MobileErrorBoundary>
          </MobileQueryProvider>
        </LocaleProvider>
      </GluestackUIProvider>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <MobileThemeProvider>
          <ThemedApp />
        </MobileThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
