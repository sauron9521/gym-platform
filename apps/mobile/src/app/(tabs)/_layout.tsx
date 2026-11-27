import { Tabs } from 'expo-router';
import { useIntl } from 'react-intl';

import { useAuth } from '@/features/auth/model/auth-context';
import { hasAthleteAccess } from '@/features/auth/model/account-capabilities';
import { useInboxCount } from '@/features/notifications/model/inbox-query';
import { InboxBell } from '@/features/notifications/ui/inbox-bell';
import { TabIcon } from '@/shared/ui/tab-icon';
import { useMobileTheme } from '@/shared/config/theme-provider';

export default function TabsLayout() {
  const { palette } = useMobileTheme();
  const { capabilities } = useAuth();
  const { count } = useInboxCount();
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.muted,
        tabBarStyle: { backgroundColor: palette.surface },
        headerRight: hasAthleteAccess(capabilities) ? () => <InboxBell count={count} /> : undefined,
        headerStyle: { backgroundColor: palette.surface },
        headerTitleStyle: { color: palette.text },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('mobile.tabs.home'),
          headerTitle: 'OVRANTO',
          tabBarButtonTestID: 'mobile-tab-home',
          tabBarIcon: ({ color, size }) => <TabIcon name="home" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          title: t('mobile.tabs.workouts'),
          tabBarButtonTestID: 'mobile-tab-workouts',
          headerTitle: t('mobile.tabs.myWorkouts'),
          tabBarIcon: ({ color, size }) => <TabIcon name="workouts" color={color} size={size} />,
        }}
      />
      <Tabs.Protected guard={hasAthleteAccess(capabilities)}>
        <Tabs.Screen
          name="progress"
          options={{
            title: t('mobile.tabs.progress'),
            headerTitle: t('mobile.progressView.title'),
            tabBarButtonTestID: 'mobile-tab-progress',
            tabBarIcon: ({ color, size }) => <TabIcon name="progress" color={color} size={size} />,
          }}
        />
      </Tabs.Protected>
      <Tabs.Screen
        name="profile"
        options={{
          title: t('mobile.tabs.profile'),
          tabBarButtonTestID: 'mobile-tab-profile',
          headerTitle: t('mobile.tabs.myProfile'),
          tabBarIcon: ({ color, size }) => <TabIcon name="profile" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
