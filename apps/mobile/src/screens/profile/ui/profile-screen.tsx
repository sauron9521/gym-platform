import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useIntl } from 'react-intl';

import { useAuth } from '@/features/auth/model/auth-context';
import { useAccountQuery } from '@/features/profile/model/account-query';
import { palette } from '@/shared/config/theme';
import { LocalePicker } from '@/shared/i18n/locale-picker';

export function ProfileScreen() {
  const router = useRouter();
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const { account, signOut } = useAuth();
  const { data, isFetching, isError, error, refetch } = useAccountQuery();

  if (!account) return null;

  const currentAccount = data ?? account;
  const name =
    currentAccount.profile?.displayName ||
    [currentAccount.profile?.firstName, currentAccount.profile?.lastName]
      .filter(Boolean)
      .join(' ') ||
    t('mobile.profile.myProfile');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      bounces={false}
    >
      <Text style={styles.heading}>{name}</Text>
      <Text style={styles.subheading}>{t('mobile.profile.apiData')}</Text>
      <LocalePicker />
      <View style={styles.card}>
        <Text style={styles.label}>{t('mobile.profile.email')}</Text>
        <Text style={styles.value}>{currentAccount.email}</Text>
        <Text style={styles.label}>{t('mobile.profile.role')}</Text>
        <Text style={styles.value}>{currentAccount.role}</Text>
        <Text style={styles.label}>{t('mobile.profile.emailStatus')}</Text>
        <Text style={styles.value}>
          {currentAccount.emailVerified
            ? t('mobile.profile.verified')
            : t('mobile.profile.unverified')}
        </Text>
        {currentAccount.profile?.height != null ? (
          <>
            <Text style={styles.label}>{t('mobile.profile.height')}</Text>
            <Text style={styles.value}>{currentAccount.profile.height} см</Text>
          </>
        ) : null}
        {currentAccount.profile?.weight != null ? (
          <>
            <Text style={styles.label}>{t('mobile.profile.weight')}</Text>
            <Text style={styles.value}>{currentAccount.profile.weight} кг</Text>
          </>
        ) : null}
      </View>
      {isError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error.message}
        </Text>
      ) : null}
      <Pressable
        testID="profile-refresh"
        accessibilityRole="button"
        accessibilityState={{ disabled: isFetching }}
        disabled={isFetching}
        onPress={() => void refetch()}
        style={styles.button}
      >
        {isFetching ? (
          <ActivityIndicator color={palette.surface} />
        ) : (
          <Text style={styles.buttonText}>{t('mobile.profile.refresh')}</Text>
        )}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/profile/edit')}
        style={styles.secondary}
      >
        <Text style={styles.secondaryText}>{t('mobile.profile.edit')}</Text>
      </Pressable>
      {account.role === 'TRAINER' ? (
        <Pressable
          accessibilityRole="button"
          testID="profile-trainer-athletes"
          onPress={() => router.push('/trainer/athletes')}
          style={styles.secondary}
        >
          <Text style={styles.secondaryText}>{t('mobile.profile.myAthletes')}</Text>
        </Pressable>
      ) : null}
      <Pressable accessibilityRole="button" onPress={() => void signOut()} style={styles.secondary}>
        <Text style={styles.secondaryText}>{t('mobile.profile.signOut')}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  content: { padding: 24, gap: 16 },
  heading: { fontSize: 30, fontWeight: '700', color: palette.text },
  subheading: { color: palette.muted, fontSize: 15 },
  card: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 22,
    gap: 10,
  },
  label: { color: palette.muted, fontSize: 13 },
  value: { color: palette.text, fontWeight: '600', fontSize: 16, marginBottom: 8 },
  error: { color: '#b91c1c', fontSize: 14 },
  button: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: palette.primary,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  buttonText: { color: palette.surface, fontWeight: '700', fontSize: 16 },
  secondary: {
    minHeight: 48,
    borderRadius: 12,
    borderColor: palette.border,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryText: { color: palette.text, fontWeight: '600', fontSize: 16 },
});
