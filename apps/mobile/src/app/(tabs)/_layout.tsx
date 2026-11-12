import { Tabs } from 'expo-router';
import { Text } from 'react-native';

import { palette } from '@/shared/config/theme';

export default function TabsLayout() {
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
