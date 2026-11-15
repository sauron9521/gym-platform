import '../../global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider, useAuth } from '@/features/auth/model/auth-context';
import { GluestackUIProvider } from '@/shared/ui/gluestack/gluestack-ui-provider';

function Navigation() {
  const { account } = useAuth();
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
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GluestackUIProvider mode="system">
        <AuthProvider>
          <Navigation />
        </AuthProvider>
      </GluestackUIProvider>
    </GestureHandlerRootView>
  );
}
