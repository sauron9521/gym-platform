import { Tabs } from 'expo-router';
import { Text } from 'react-native';

import { useAuth } from '@/features/auth/model/auth-context';
import { palette } from '@/shared/config/theme';

export default function TabsLayout() {
  const { account } = useAuth();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.muted,
        tabBarStyle: { backgroundColor: palette.surface },
        headerStyle: { backgroundColor: palette.surface },
        headerTitleStyle: { color: palette.text },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerTitle: 'Gym Platform',
          tabBarIcon: () => <Text accessible={false}>🏋️</Text>,
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          title: 'Тренування',
          headerTitle: 'Мої тренування',
          tabBarIcon: () => <Text accessible={false}>📋</Text>,
        }}
      />
      <Tabs.Screen
        name="programs"
        options={{
          title: 'Програми',
          headerTitle: 'Мої програми',
          href: account?.role === 'ATHLETE' ? undefined : null,
          tabBarIcon: () => <Text accessible={false}>📅</Text>,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          headerTitle: 'Your Profile',
          tabBarIcon: () => <Text accessible={false}>👤</Text>,
        }}
      />
    </Tabs>
  );
}
