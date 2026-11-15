import '../../global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider, useAuth } from '@/features/auth/model/auth-context';
import { GluestackUIProvider } from '@/shared/ui/gluestack/gluestack-ui-provider';
import { MobileQueryProvider } from '@/shared/api/query-provider';
import { palette } from '@/shared/config/theme';

function Navigation() {
  const { account, restoring } = useAuth();
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={Boolean(account)}>
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>
        <Stack.Protected guard={!account}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
      </Stack>
      <StatusBar style="auto" />
      {restoring ? (
        <View
          accessibilityLabel="Відновлення сесії"
          style={styles.loadingOverlay}
        >
          <ActivityIndicator color={palette.primary} size="large" />
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GluestackUIProvider mode="system">
        <MobileQueryProvider>
          <AuthProvider>
            <Navigation />
          </AuthProvider>
        </MobileQueryProvider>
      </GluestackUIProvider>
    </GestureHandlerRootView>
  );
}
