import { useAuth } from '@/features/auth/model/auth-context';
import { hasAthleteAccess } from '@/features/auth/model/account-capabilities';
import { InboxScreen } from '@/features/notifications/ui/inbox-screen';

export default function NotificationsRoute() {
  const { account, capabilities } = useAuth();
  if (!account || !hasAthleteAccess(capabilities)) return null;
  return <InboxScreen key={account.id} />;
}
