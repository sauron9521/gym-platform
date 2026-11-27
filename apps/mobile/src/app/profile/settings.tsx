import { NotificationSettingsPanel } from '@/features/notifications/ui/notification-settings-panel';
import { AppSettingsScreen } from '@/screens/profile/ui/app-settings-screen';

export default function AppSettingsRoute() {
  return (
    <AppSettingsScreen>
      <NotificationSettingsPanel />
    </AppSettingsScreen>
  );
}
