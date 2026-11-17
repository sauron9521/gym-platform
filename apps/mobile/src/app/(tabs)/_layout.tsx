import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useIntl } from 'react-intl';

import { useAuth } from '@/features/auth/model/auth-context';
import { palette } from '@/shared/config/theme';

export default function TabsLayout() {
  const { account } = useAuth();
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
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
          title: t('mobile.tabs.home'),
          headerTitle: 'Gym Platform',
          tabBarIcon: () => <Text accessible={false}>🏋️</Text>,
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          title: t('mobile.tabs.workouts'),
          tabBarButtonTestID: 'mobile-tab-workouts',
          headerTitle: t('mobile.tabs.myWorkouts'),
          tabBarIcon: () => <Text accessible={false}>📋</Text>,
        }}
      />
      <Tabs.Screen
        name="programs"
        options={{
          title: t('mobile.tabs.programs'),
          headerTitle: t('mobile.tabs.myPrograms'),
          href: account?.role === 'ATHLETE' ? undefined : null,
          tabBarIcon: () => <Text accessible={false}>📅</Text>,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('mobile.tabs.profile'),
          headerTitle: t('mobile.tabs.myProfile'),
          tabBarIcon: () => <Text accessible={false}>👤</Text>,
        }}
      />
    </Tabs>
  );
}
